console.log("Dog");

declare const browser: {
    storage: {
        local: {
            get: (keys: string[] | string) => { [key: string]: unknown },
            set: (obj: { [key: string]: any }) => unknown,
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

/*
    Script overview

    - Sets up a MutationObserver at injection time (DOM load) to catch element insertion after page load
    - Removes username and @ from text nodes
*/

/**
 * @param {string} str exact text to match in regex
 * @returns string for use in RegExp constructer
 */
const escape_reg_exp = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
};

/**
 * @param {number} num
 * @returns whether num is prime
 */
const is_prime = (num: number) => {
    for (let i = 2, s = Math.sqrt(num); i <= s; i++) {
        if (num % i === 0) {
            return false;
        }
    }
    return num > 1;
}

/**
 * @param {number} num
 * @returns xth prime where x is num
 */
const xth_prime = (num: number) => {
    let count = 1;
    let i = 2;
    while (count < num) {
        i++;
        if (is_prime(i)) {
            count++;
        }
    }
    return i;
}

const rand_el = <T>(list: T[]): T => {
    return list[Math.floor(Math.random() * list.length)];
}

const PERIOD_MAP = {
    "min": 60,
    "hr": 60 * 60,
    "day": 24 * 60 * 60,
    "wk": 7 * 24 * 60 * 60
} as const;

const cyrb53_hashcode = function (str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

// Gets a large prime number as a hash of the array
const list_seed_autogen = (elements: string[]): number => {
    let hash = 0;
    for (const element of elements) {
        hash ^= cyrb53_hashcode(element);
    }
    hash = Math.abs(hash);

    let rejections = hash % 100_000;

    // Minimum prime size: 1000
    // Must also be greater than length of the list of possible replacements
    let i = Math.min(Math.pow(elements.length, 2), 1000) + 1;
    // We reject a lot of primes randomly based on the hash
    while (is_prime(i) === false || ((rejections--) > 0)) {
        i++;
    }

    return i;
}

/**
 * Generates a random index based on a period and a prime
 * @param period A number of seconds for the generation to change in
 * @param max_index The max output index
 * @param seed A large prime for randomization purposes
 */
const generate_random_index = (period: number, max_index: number, seed: number, offset = 0) => {
    const seed_factor = Math.pow(seed, 2);
    const seconds = Math.floor(new Date().getTime() / 1000);
    // choosing a low period can sometimes make the xth_prime calculation take wayyyy too long
    // magic number is a lowball of the seconds since epoch
    const calculated_offset = offset + Math.floor(1_658_000_000 / period);
    const current_period = Math.floor(seconds / period) - calculated_offset;
    const period_factor = xth_prime(current_period);

    return (period_factor * seed_factor) % max_index;
}

const use_replace_filter = (filter: Filter, str: string): string => {
    // composition of args:
    // [...[numbered capture groups], offset, whole string, named_groups]
    let target_regex =
        filter.target_specifier.type === TargetSpecifierType.RawText
            ? new RegExp(escape_reg_exp(filter.target_specifier.text), "g")
            : new RegExp(filter.target_specifier.regex_text, filter.target_specifier.flags);
    return str.replaceAll(target_regex, (substring: string, ...args: unknown[]): string => {
        const number_index = args.findIndex(x => typeof x === "number");
        const numbered_cap_groups = args.slice(0, number_index);
        const offset = args[number_index];
        const whole_string = args[number_index + 1];
        const named_groups = (number_index + 2 >= args.length) ? undefined : args[number_index + 2];

        let buf = "";

        for (const element of filter.replacement_specifier) {
            switch (element.type) {
                case ReplacementSpecifierElementType.ExactText: {
                    buf += element.text;
                    break;
                }
                case ReplacementSpecifierElementType.CaptureGroup: {
                    if (element.group_type === "named") {
                        if (named_groups === undefined || typeof named_groups !== "object") {
                            console.log(`scratchthat: use_replace_filter - Named groups is undefined, so couldn't replace with text in named group ${element.group_name}.`)
                            break;
                        }
                        else if (element.group_name in named_groups) {
                            buf += named_groups[element.group_name];
                            break;
                        }
                        else {
                            console.log(`scratchthat: use_replace_filter - Named groups is does not include key, so couldn't replace with text in named group ${element.group_name}.`)
                            break;
                        }
                    }
                    else if (element.group_type === "numbered") {
                        if (element.group_number <= numbered_cap_groups.length) {
                            buf += numbered_cap_groups[element.group_number - 1];
                            break;
                        }
                        else {
                            console.log(`scratchthat: use_replace_filter - There are ${numbered_cap_groups.length} numbered capture groups, but the replacement filter specifies capture group #${element.group_number}; couldn't replace with text in numbered group.`)
                            break;
                        }
                    }
                }
                case ReplacementSpecifierElementType.List: {
                    if (element.periodization === "inst") {
                        buf += rand_el(element.elements);
                    }
                    else {
                        const seed = element.seed === "autogen" ? list_seed_autogen(element.elements) : element.seed;
                        buf += element.elements[generate_random_index(PERIOD_MAP[element.periodization], element.elements.length, seed, element.offset)];
                    }
                }
            }
        }

        return buf;
    })
};

const use_replace_filters = (filters: Filter[], str: string): string => {
    if (filters.length === 0) return str;
    if (filters.length === 1) return use_replace_filter(filters[0], str);
    else {
        return use_replace_filters(filters.slice(1), use_replace_filter(filters[0], str));
    }
}

/**
 * @param {string} key
 */
const storage_get = async (key: string) => {
    return (await browser.storage.local.get(key))[key];
}

const get_applicable_filters = async (url: string) => {
    return (await storage_get("filters") as Filter[]).filter(x => {
        switch (x.url_specifier.type) {
            case URLSpecifierType.All: {
                return true;
            }
            case URLSpecifierType.DomainName: {
                return new RegExp(`^http(?:s)?://(?:(?:[a-z0-9]+\\.)(?:(?:(?:[a-z0-9]+))\\.)*)?${escape_reg_exp(x.url_specifier.domain)}(/.*)?$`, 'i').test(url)
            }
            case URLSpecifierType.Regex: {
                return new RegExp(x.url_specifier.regex_text, x.url_specifier.flags).test(url)
            }
        }
    })
}

(async () => {

    const LOG = true;

    const log = (...args) => {
        if (LOG) console.log(...args);
    }

    const RANDOM_ID = Math.round(Math.random() * 65536);

    let filters = await get_applicable_filters(document.location.href);

    /**
     * @param {string} str
     */
    const fix_text = (str: string) => {
        return use_replace_filters(filters, str)
    }

    /**
     * @param {Node} el
     * @param {(arg0: Node) => void} closure
     */
    const for_text_in_children = (el: Node, closure: (arg0: Node) => void) => {
        if (el.nodeType === Node.TEXT_NODE) {
            const parent = el.parentNode;
            // @ts-ignore
            if (parent !== null && (parent.nodeType === Node.ELEMENT_NODE && (parent.tagName === "SCRIPT" || parent.tagName === "STYLE" || parent.tagName === "NOSCRIPT"))) {
                return;
            }
            else if (el.textContent.trim().length === 0) {
                return;
            }
            else {
                log(el);
                closure(el);
            }
        }
        el.childNodes.forEach(x => for_text_in_children(x, closure));
    }

    let stopped = true;

    /**
     * @param {MutationObserver} obs
     */
    const stop = (obs: MutationObserver) => {
        if (!stopped) {
            stopped = true;
            obs.disconnect();
        }
    }


    /**
     * @param {MutationObserver} obs
     */

    const start = (obs: MutationObserver) => {
        if (stopped) {
            stopped = false;
            obs.observe(document, { subtree: true, childList: true, characterData: true });
        }
    }

    /**
     * @param {Node} el
     * @param {MutationObserver} obs
     */
    const obs_check = (el: Node, obs: MutationObserver) => {
        for_text_in_children(el, text_el => {
            stop(obs);
            text_el.textContent = fix_text(text_el.textContent);
        });
    }

    let old_window_location = document.location.href;

    // Re-index filters
    const on_url_change = async () => {
        filters = await get_applicable_filters(document.location.href);
    };

    let observer = new MutationObserver(async mutations => {
        log(mutations);
        mutations.forEach(mutation => {
            if (mutation.type === "childList" || mutation.type === "characterData") {
                obs_check(mutation.target, observer);
                if (mutation.type === "childList") {
                    mutation.addedNodes.forEach(x => obs_check(x, observer));
                }
                if (document.location.href !== old_window_location) {
                    old_window_location = document.location.href;
                    on_url_change().then(() => {
                        console.log("Updated filters", filters);
                    });
                }
            }
        });
        start(observer);
    });

    window.addEventListener("DOMContentLoaded", () => {
        for_text_in_children(document, text_el => {
            stop(observer);
            text_el.textContent = fix_text(text_el.textContent);
        });

        start(observer);
    });

})();