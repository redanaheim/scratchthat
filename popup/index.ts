declare const browser: {
    storage: {
        local: {
            get: (keys: string[] | string) => Promise<{ [key: string]: unknown }>,
            set: (obj: { [key: string]: any }) => Promise<unknown>,
        }
    }
}

const enum URLSpecifierType {
    All,
    DomainName,
    Regex
}

type URLSpecifier =
    | { type: URLSpecifierType.All }
    | { type: URLSpecifierType.DomainName, domain: string }
    | { type: URLSpecifierType.Regex, regex_text: string, flags: string };

const enum TargetSpecifierType {
    RawText,
    Regex
}

type TargetSpecifier =
    | { type: TargetSpecifierType.RawText, text: string }
    | { type: TargetSpecifierType.Regex, regex_text: string, flags: string };

const enum ReplacementSpecifierElementType {
    List,
    CaptureGroup,
    ExactText
}

const LIST_PERIODIZATION_SPECIFIERS = ["min", "hr", "day", "wk", "inst"] as const;

type ListPeriodizationSpecifier = (typeof LIST_PERIODIZATION_SPECIFIERS)[number];

type CaptureGroupType = ["numbered", "named"][number];

type CaptureGroupReplacementSpecifierElement =
    | { type: ReplacementSpecifierElementType.CaptureGroup, group_type: "numbered", group_number: number }
    | { type: ReplacementSpecifierElementType.CaptureGroup, group_type: "named", group_name: string };

type ReplacementSpecifierElement =
    | { type: ReplacementSpecifierElementType.List, periodization: ListPeriodizationSpecifier, elements: string[], seed: number | "autogen", offset: number }
    | CaptureGroupReplacementSpecifierElement
    | { type: ReplacementSpecifierElementType.ExactText, text: string };

interface Filter {
    url_specifier: URLSpecifier,
    target_specifier: TargetSpecifier,
    replacement_specifier: ReplacementSpecifierElement[]
}

/**
 * ```ts
 * is_escaped(0, "\\") === false;
 * is_escaped(1, "\\/") === true;
 * is_escaped(0, "\\/") === false;
 * is_escaped(2, "\\\\/") === false;
 * ```
 * @param index index to check
 * @param str string
 * @returns whether the given character is escaped in the string, meaning it has a preceding backslash that isn't escaped.
 * The first character in a string is never escaped.
 */
const is_escaped = (index: number, str: string): boolean => {
    if (index === 0) return false;
    return str[index - 1] === "\\" && !is_escaped(index - 1, str);
}

const unescape_all = (str: string): string => {
    let new_str = str.replaceAll(/\\n/g, "\n");
    let buf = "";
    for (let i = new_str.length - 1; i >= 0; i--) {
        buf = str[i] + buf;
        if (is_escaped(i, new_str)) {
            i--;
        }
    }
    return buf;
}

/**
 * creates a new string out of str where all the chars will return true when is_escaped() is called on them
 * @param str
 * @param chars a set of chars to escape. backslashes will always be escaped no matter what.
 */
const escape_chars = (str: string, chars: string): string => {
    let char_set = new Set(chars.split(""));
    char_set.add("\\");
    let buf = "";
    for (let i = 0; i < str.length; i++) {
        if (char_set.has(str[i])) {
            buf += "\\";
            buf += str[i];
        }
        else buf += str[i];
    }
    return buf;
}

const process_exact_replacement_text = (str: string): string => {
    const escaped = escape_chars(str, ",()");
    return escaped.replaceAll(/\n/g, "\\n");
}

const serialize_filter = (filter: Filter): string => {
    const url_spec_segment = (() => {
        switch (filter.url_specifier.type) {
            case URLSpecifierType.All: {
                return "*";
            };
            case URLSpecifierType.DomainName: {
                return filter.url_specifier.domain;
            }
            case URLSpecifierType.Regex: {
                return `/${escape_chars(filter.url_specifier.regex_text, "/")}/${filter.url_specifier.flags}`
            }
        }
    })();

    const target_spec_segment = (() => {
        switch (filter.target_specifier.type) {
            case TargetSpecifierType.RawText: {
                return escape_chars(filter.target_specifier.text, ",");
            }
            case TargetSpecifierType.Regex: {
                return `/${escape_chars(filter.target_specifier.regex_text, "/")}/${filter.target_specifier.flags}`
            }
        }
    })();

    const replacement_spec_segment = (() => {
        let buf = "";
        for (const element of filter.replacement_specifier) {
            switch (element.type) {
                case ReplacementSpecifierElementType.ExactText: {
                    buf += process_exact_replacement_text(element.text);
                    break;
                }
                case ReplacementSpecifierElementType.CaptureGroup: {
                    if (element.group_type === "named") {
                        buf += `($${element.group_name})`;
                    }
                    else {
                        buf += `($${element.group_number})`
                    }
                    break;
                }
                case ReplacementSpecifierElementType.List: {
                    buf += `(${element.seed},${element.periodization},${element.elements.map(process_exact_replacement_text).join(",")})`;
                    break;
                }
            }
        }
        return buf;
    })();

    return `${url_spec_segment},${target_spec_segment},${replacement_spec_segment}`;
}

const FILTER_ERRORS = [
    "EMPTY_FILTER_STRING",
    "NO_URL_SPECIFIER",
    "NO_TARGET_SPECIFIER",
    "NO_REPLACEMENT_SPECIFIER",
    "ILLEGAL_REGEX_FLAGS_CHARACTER",
    "ILLEGAL_DOMAIN_NAME",
    "UNTERMINATED_REGEX_SOURCE",
    "UNTERMINATED_PARENTHESES_GROUP",
    "MALFORMED_LIST"
] as const;
type FilterErrorType = (typeof FILTER_ERRORS)[number];
type FilterError = { type: FilterErrorType, description?: string }

const enum DeserializationPhase {
    URLSpecifier = "URL specifier",
    TargetSpecifier = "target specifier",
    ReplacementSpecifier = "replacement specifier"
}

const deserialize_filter = (filter: string): Filter | FilterError => {
    if (filter.length === 0) return { type: "EMPTY_FILTER_STRING" };
    let buf = "";
    let regex_src_buf = "";
    let regex_flag_buf = "";
    let phase = DeserializationPhase.URLSpecifier as DeserializationPhase;
    let url_specifier: URLSpecifier;
    let target_specifier: TargetSpecifier;
    let replacement_specifier: ReplacementSpecifierElement[] = [];
    let inside_slash = false;
    let inside_flags = false;
    let inside_parens = false;
    let inside_cap_group = false;
    let paren_buf = "";

    let phase_index = 0;

    const clear_bufs = () => {
        buf = "";
        regex_src_buf = "";
        regex_flag_buf = "";
        inside_slash = false;
        inside_flags = false;
    };

    const flag_error = (char: string, i: number): FilterError => {
        return { type: "ILLEGAL_REGEX_FLAGS_CHARACTER", description: `Character "${char}" found at index ${i} in filter string - not a valid regex flag character. Valid flags are any of "dimsuy" (not case sensitive.)`};
    };

    const set_phase = (target_phase: DeserializationPhase) => {
        phase = target_phase;
        phase_index = -1;
    }

    for (let i = 0; i < filter.length; i++, phase_index++) {
        const char = filter[i];
        switch (phase) {
            case DeserializationPhase.URLSpecifier: {
                if (char === "/") {
                    if (i === 0) {
                        inside_slash = true;
                    }
                    else if (inside_slash && !is_escaped(i, filter)) {
                        inside_flags = true;
                        inside_slash = false;
                    }
                }
                else if (inside_slash) {
                    regex_src_buf += char;
                    continue;
                }
                else if (inside_flags) {
                    if (/^[dimsuy]$/i.test(char)) {
                        regex_flag_buf += char.toLowerCase();
                    }
                    else if (char !== ",") {
                        return flag_error(char, i);
                    }
                }
                else if (char !== "," || is_escaped(i, filter)) {
                    buf += char;
                }
                break;
            }
            case DeserializationPhase.TargetSpecifier: {
                if (char === "/") {
                    if (phase_index === 0) {
                        inside_slash = true;
                    }
                    else if (inside_slash && !is_escaped(i, filter)) {
                        inside_flags = true;
                        inside_slash = false;
                    }
                    else if (inside_slash) {
                        regex_src_buf += char;
                        continue;
                    }
                }
                else if (inside_slash) {
                    regex_src_buf += char;
                    continue;
                }
                else if (inside_flags) {
                    if (/^[dimsuy]$/i.test(char)) {
                        regex_flag_buf += char.toLowerCase();
                    }
                    else if (char !== ",") {
                        return flag_error(char, i);
                    }
                }
                else if (char !== "," || is_escaped(i, filter)) {
                    buf += char;
                }
                break;
            }
            case DeserializationPhase.ReplacementSpecifier: {
                if (char === "(" && !is_escaped(i, filter)) {
                    inside_parens = true;

                    if (buf.length > 0) {
                        replacement_specifier.push({ type: ReplacementSpecifierElementType.ExactText, text: unescape_all(buf) });
                        buf = "";
                    }

                    if (filter[i + 1] === "$") {
                        inside_cap_group = true;
                        i++, phase_index++;
                    }
                }
                else if (char === ")" && inside_parens === true && !is_escaped(i, filter)) {
                    if (inside_cap_group) {
                        if (/^\d+$/.test(paren_buf)) {
                            replacement_specifier.push({ type: ReplacementSpecifierElementType.CaptureGroup, group_type: "numbered", group_number: Number(paren_buf) });
                            paren_buf = "";
                            inside_parens = false;
                            inside_cap_group = false;
                        }
                        else if (/^[a-z0-9_]+$/i.test(paren_buf)) {
                            replacement_specifier.push({ type: ReplacementSpecifierElementType.CaptureGroup, group_type: "named", group_name: paren_buf });
                            paren_buf = "";
                            inside_parens = false;
                            inside_cap_group = false;
                        }
                    }
                    else {
                        // (autogen,day,James Doe,Jimmy John,Papa Murphy)
                        const list_parts = paren_buf.split(",");
                        if (list_parts.length < 3) {
                            return { 
                                type: "MALFORMED_LIST",
                                description: `Parenthesised section was interpreted to be a list, as it did not begin with a dollar sign. A valid list is made up of a seed specifier (either a positive integer or "autogen"), a periodization specifier (one of "inst", "min", "hr", "day", or "wk"), and at least one element, comma separated.`
                            };
                        }
                        else {
                            const seed = list_parts[0].trim();
                            const periodization = list_parts[1].trim().toLowerCase();
                            const rest = list_parts.slice(2).map(unescape_all);
                            if (/^(?:\d+)|(?:autogen)$/.test(seed) === false) {
                                return {
                                    type: "MALFORMED_LIST",
                                    description: `Parenthesised section was interpreted to be a list, as it did not begin with a dollar sign. The first element of a list is a seed specifier, and must be either a positive integer or "autogen".`
                                };
                            }
                            if ((LIST_PERIODIZATION_SPECIFIERS as readonly unknown[]).includes(periodization) === false) {
                                return { 
                                    type: "MALFORMED_LIST",
                                    description: `Parenthesised section was interpreted to be a list, as it did not begin with a dollar sign. The second element of a list is a periodization specifier, and must be one of "inst", "min", "hr", "day", or "wk".`
                                };
                            }

                            replacement_specifier.push({
                                type: ReplacementSpecifierElementType.List,
                                seed: seed === "autogen" ? seed : Number(seed),
                                periodization: periodization as ListPeriodizationSpecifier,
                                elements: rest,
                                offset: 0
                            });

                            paren_buf = "";
                            inside_parens = false;
                            inside_cap_group = false;
                        }
                    }
                }
                else {
                     if (inside_parens) {
                        paren_buf += char;
                    }
                    else {
                        buf += char;
                    }
                }
            }
        }
        // If we see an unescaped comma before the replacement specifier phase, we should go to the next phase.
        if (filter[i] === "," && !is_escaped(i, filter)) {
            switch (phase) {
                case DeserializationPhase.URLSpecifier: {
                    set_phase(DeserializationPhase.TargetSpecifier);
                    if (buf === "*") {
                        url_specifier = { type: URLSpecifierType.All };
                    }
                    else if (inside_flags) {
                        url_specifier = { type: URLSpecifierType.Regex, regex_text: regex_src_buf, flags: regex_flag_buf };
                    }
                    else {
                        if (/^([a-z0-9]+(?:\.(?:[a-z0-9]+))+)$/i.test(buf)) {
                            url_specifier = { type: URLSpecifierType.DomainName, domain: buf };
                        }
                        else {
                            return { type: "ILLEGAL_DOMAIN_NAME", description: `URL specifier was interpreted to be a domain name, as it did not begin with a slash and was not the wildcard domain "*". A valid domain name consists of two or more sequences of letters and/or numbers, separated by dots.` };
                        }
                    }
                    clear_bufs();
                    break;
                }
                case DeserializationPhase.TargetSpecifier: {
                    set_phase(DeserializationPhase.ReplacementSpecifier);
                    if (inside_flags) {
                        target_specifier = { type: TargetSpecifierType.Regex, regex_text: unescape_all(regex_src_buf), flags: regex_flag_buf + "g" };
                    }
                    else {
                        target_specifier = { type: TargetSpecifierType.RawText, text: buf };
                    }
                    clear_bufs();
                    break;
                }
            }
        }
    }
    if (inside_slash) {
        return { type: "UNTERMINATED_REGEX_SOURCE", description: `Ended filter parsing in the ${phase} due to an unterminated regex source. Missing a closing forward slash.`}
    }
    if (inside_parens) {
        return { type: "UNTERMINATED_PARENTHESES_GROUP", description: `Ended filter parsing in the ${phase} due to an unterminated parentheses group. Missing a closing parenthesis.`}
    }
    if (buf.length > 0) {
        replacement_specifier.push({ type: ReplacementSpecifierElementType.ExactText, text: buf });
    }
    if (phase !== DeserializationPhase.ReplacementSpecifier) {
        return { type: "NO_REPLACEMENT_SPECIFIER"}
    }
    // @ts-ignore
    return { url_specifier: url_specifier, target_specifier: target_specifier, replacement_specifier: replacement_specifier };
}

const bind_value = async <Type extends "string" | "number">(element_id: string, property_name: string, type: Type, dfault: Type extends "string" ? string : number, trim?: boolean) => {
    const update = async () => {
        const val = (document.getElementById(element_id) as HTMLInputElement).value;
        if (type === "number") {
            await browser.storage.local.set({[property_name]: Number(val)});
        }
        else if (trim === true) await browser.storage.local.set({[property_name]: val.split("\n").map(x => x.trim()).join("\n")});
        else {
            await browser.storage.local.set({[property_name]: val });
        }
    }

    let input = document.getElementById(element_id) as HTMLInputElement;
    input.onchange = update;

    let results = await browser.storage.local.get(property_name);

    if (typeof results[property_name] !== type) {
        input.value = dfault.toString();
        update();
    }
    else {
        input.value = results[property_name].toString();
    }
}

const is_prime = num => {
    for (let i = 2, s = Math.sqrt(num); i <= s; i++) {
        if (num % i === 0) {
            return false;
        }
    }
    return num > 1;
}

let line_widgets: Map<number, CodeMirror.LineWidget> = new Map();
let errored_lines: Set<number> = new Set();

const add_error = (line: number, filter_error: FilterError, code_mirror: CodeMirror.EditorFromTextArea) => {
    let error = document.createElement("p");
    error.innerText = ` ^ Error: ${filter_error.type.toLowerCase().split("_").join(" ")}${typeof filter_error.description === "string" ? ` - ${filter_error.description}` : ""}`;
    error.classList.add("line_error")
    let widget = code_mirror.addLineWidget(line, error);
    if (line_widgets.has(line)) {
        line_widgets.get(line).clear();
    }
    line_widgets.set(line, widget);
    errored_lines.add(line);
}

const clear_error = (line: number, code_mirror: CodeMirror.EditorFromTextArea) => {
    if (line_widgets.has(line)) {
        line_widgets.get(line).clear();
    }
    line_widgets.delete(line);
    errored_lines.delete(line);
}

window.addEventListener("DOMContentLoaded", async () => {

    const filters_input = document.getElementById("filters") as HTMLTextAreaElement;

    const previous_editor_value = await browser.storage.local.get("editor_val");

    const current_val = ((typeof previous_editor_value["editor_val"]) === "string") ? previous_editor_value["editor_val"] as string : "lul"

    const code_mirror = CodeMirror.fromTextArea(filters_input, {
        theme: "midnight",
        lineNumbers: true,
    });

    code_mirror.setValue(current_val);

    // await bind_value("filters", "raw_filters", "string", "*,omw,on my way", true)

    let changes_saved = true;

    const save_btn = document.getElementById("save");
    const unsaved_changes = document.getElementById("unsaved_changes");

    const unsaved = () => {
        changes_saved = false;
        unsaved_changes.innerText = "*";
    }

    const saved = () => {
        changes_saved = true;
        unsaved_changes.innerText = "";
    }

    let valid_lines: Filter[] = [];

    const check_lines = (lines: string[]) => {

        valid_lines = [];

        lines.forEach((x, index) => {
            const line = index;
            let res = deserialize_filter(x);
            if ("type" in res) {
                add_error(line, res, code_mirror);
            }
            else {
                clear_error(line, code_mirror);
                valid_lines.push(res);
            }
        });
    }

    check_lines(code_mirror.getValue().split("\n"));

    code_mirror.on("change", async (e, change) => {
        unsaved();

        const val = code_mirror.getValue();

        await browser.storage.local.set({
            editor_val: val
        });

        let lines = val.split("\n");

        check_lines(lines);

        for (const line of errored_lines) {
            if (line >= lines.length) clear_error(line, code_mirror);
        }

    })

    save_btn.onclick = async () => {
        await browser.storage.local.set({
            filters: valid_lines
        });
        console.log("Saved:", valid_lines);
        saved();
    };
});