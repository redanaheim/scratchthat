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