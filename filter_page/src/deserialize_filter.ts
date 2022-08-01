export const enum URLSpecifierType {
    All,
    DomainName,
    Regex
}

export type URLSpecifier =
    | { type: URLSpecifierType.All }
    | { type: URLSpecifierType.DomainName, domain: string }
    | { type: URLSpecifierType.Regex, regex_text: string, flags: string };

export const enum TargetSpecifierType {
    RawText,
    Regex
}

export type TargetSpecifier =
    | { type: TargetSpecifierType.RawText, text: string }
    | { type: TargetSpecifierType.Regex, regex_text: string, flags: string };

export const enum ReplacementSpecifierElementType {
    List,
    CaptureGroup,
    ExactText
}

export const LIST_PERIODIZATION_SPECIFIERS = ["min", "hr", "day", "wk", "inst"] as const;

export type ListPeriodizationSpecifier = (typeof LIST_PERIODIZATION_SPECIFIERS)[number];

export type CaptureGroupType = ["numbered", "named"][number];

export type CaptureGroupReplacementSpecifierElement =
    | { type: ReplacementSpecifierElementType.CaptureGroup, group_type: "numbered", group_number: number }
    | { type: ReplacementSpecifierElementType.CaptureGroup, group_type: "named", group_name: string };

export type ListReplacementSpecifierElement = 
    | { type: ReplacementSpecifierElementType.List, periodization: ListPeriodizationSpecifier, elements: string[], seed: number | "autogen", offset: number }
    | { type: ReplacementSpecifierElementType.List, periodization: ListPeriodizationSpecifier, name: string, seed: number | "autogen", offset: number }

export type ReplacementSpecifierElement =
    | ListReplacementSpecifierElement
    | CaptureGroupReplacementSpecifierElement
    | { type: ReplacementSpecifierElementType.ExactText, text: string };

export interface Filter {
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
export const is_escaped = (index: number, str: string): boolean => {
    if (index === 0) return false;
    return str[index - 1] === "\\" && !is_escaped(index - 1, str);
}

export const unescape_all = (str: string): string => {
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
export const escape_chars = (str: string, chars: string): string => {
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

export const process_exact_replacement_text = (str: string): string => {
    const escaped = escape_chars(str, ",()");
    return escaped.replaceAll(/\n/g, "\\n");
}

export const FILTER_ERRORS = [
    "EMPTY_FILTER_STRING",
    "NO_URL_SPECIFIER",
    "NO_TARGET_SPECIFIER",
    "NO_REPLACEMENT_SPECIFIER",
    "ILLEGAL_REGEX_FLAGS_CHARACTER",
    "ILLEGAL_DOMAIN_NAME",
    "UNTERMINATED_REGEX_SOURCE",
    "UNTERMINATED_PARENTHESES_GROUP",
    "MALFORMED_LIST",
    "ILLEGAL_LIST_NAME",
    "ILLEGAL_CAPTURE_GROUP_NAME",
    "CAPTURE_GROUP_IN_REPLACEMENT_SPECIFIER_WHERE_TARGET_IS_NOT_REGEX",
] as const;
export type FilterErrorType = (typeof FILTER_ERRORS)[number];
export type FilterError = { type: FilterErrorType, description?: string }

export const enum DeserializationPhase {
    URLSpecifier = "URL specifier",
    TargetSpecifier = "target specifier",
    ReplacementSpecifier = "replacement specifier"
}

export const deserialize_filter = (filter: string): Filter | FilterError => {
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
                        const target_error: FilterError = { 
                            type: "CAPTURE_GROUP_IN_REPLACEMENT_SPECIFIER_WHERE_TARGET_IS_NOT_REGEX",
                            description: "parenthesised section starting with dollar sign was interpreted to be a capture group, but the target specifier was not a regex, so no captured text can be filled in."
                        };
                        if (/^\d+$/.test(paren_buf)) {
                            if (target_specifier.type === TargetSpecifierType.RawText) {
                                return target_error;
                            }
                            replacement_specifier.push({ type: ReplacementSpecifierElementType.CaptureGroup, group_type: "numbered", group_number: Number(paren_buf) });
                            paren_buf = "";
                            inside_parens = false;
                            inside_cap_group = false;
                        }
                        else if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(paren_buf)) {
                            if (target_specifier.type === TargetSpecifierType.RawText) {
                                return target_error;
                            }
                            replacement_specifier.push({ type: ReplacementSpecifierElementType.CaptureGroup, group_type: "named", group_name: paren_buf });
                            paren_buf = "";
                            inside_parens = false;
                            inside_cap_group = false;
                        }
                        else {
                            return { type: "ILLEGAL_CAPTURE_GROUP_NAME", description: `Parenthesized section was interpreted to be a named capture group because it started with a "$". A valid capture group name begins with a letter or an underscore and contains only alphanumeric characters and underscores.` }
                        }
                    }
                    else {
                        const LIST_MESSAGE = `Parenthesised section was interpreted to be a list, as it did not begin with a dollar sign.`;

                        // (autogen,day,James Doe,Jimmy John,Papa Murphy)
                        const list_parts = paren_buf.split(",");
                        if (list_parts.length < 3) {
                            return { 
                                type: "MALFORMED_LIST",
                                description: `${LIST_MESSAGE} A valid list is made up of a seed specifier (either a positive integer or "autogen"), a periodization specifier (one of "inst", "min", "hr", "day", or "wk"), and either a name or at least two elements, comma separated.`
                            };
                        }

                        const seed = list_parts[0].trim();
                        const periodization = list_parts[1].trim().toLowerCase();
                        const rest = list_parts.slice(2).map(unescape_all);

                        if (rest.length === 1) {
                            const name = rest[0].trim();
                            if (/^[a-zA-Z0-9_]+$/.test(name) === false) {
                                return {
                                    type: "ILLEGAL_LIST_NAME",
                                    description: `${LIST_MESSAGE} A valid list is made up of a seed specifier (either a positive integer or "autogen"), a periodization specifier (one of "inst", "min", "hr", "day", or "wk"), and either a name or at least two elements, comma separated. A list name must be made up only of letters, numbers, and underscores.`
                                }
                            }
                            else {

                                replacement_specifier.push({
                                    type: ReplacementSpecifierElementType.List,
                                    seed: seed === "autogen" ? seed : Number(seed),
                                    periodization: periodization as ListPeriodizationSpecifier,
                                    name: name,
                                    offset: 0
                                });

                                paren_buf = "";
                                inside_parens = false;
                                inside_cap_group = false;
                            }
                        }
                        else {
                            const seed = list_parts[0].trim();
                            const periodization = list_parts[1].trim().toLowerCase();
                            const rest = list_parts.slice(2).map(unescape_all);
                            if (/^(?:\d+)|(?:autogen)$/.test(seed) === false) {
                                return {
                                    type: "MALFORMED_LIST",
                                    description: `${LIST_MESSAGE} The first element of a list is a seed specifier, and must be either a positive integer or "autogen".`
                                };
                            }
                            if ((LIST_PERIODIZATION_SPECIFIERS as readonly unknown[]).includes(periodization) === false) {
                                return { 
                                    type: "MALFORMED_LIST",
                                    description: `${LIST_MESSAGE} The second element of a list is a periodization specifier, and must be one of "inst", "min", "hr", "day", or "wk".`
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

export const is_prime = (num: number) => {
    for (let i = 2, s = Math.sqrt(num); i <= s; i++) {
        if (num % i === 0) {
            return false;
        }
    }
    return num > 1;
}
