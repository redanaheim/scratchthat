import { LRLanguage, LanguageSupport } from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";
import type { LRParser } from "@lezer/lr";
import type { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { parser } from "../../filter";
import { linter } from "@codemirror/lint";
import type { Diagnostic } from "@codemirror/lint";
import { deserialize_filter } from "../deserialize_filter";

const parser_with_metadata = (parser as LRParser).configure({
    props: [
        styleTags({
            Regex: t.variableName,
            RegexContent: t.variableName,
            RegexFlags: t.keyword,
            DomainName: t.string,
            AllDomains: t.keyword,
            Comment: t.lineComment,
            ListSeedSpec: t.keyword,
            ListPeriodSpec: t.keyword,
            ListContent: t.string,
            ExactTargetContent: t.string,
            NotSlashComma: t.string,
            NamedCapGroup: t.inserted,
            NumberedCapGroup: t.inserted,
            CapGroupName: t.variableName,
            Digits: t.number,
            DomainFragment: t.string,
            NoParens: t.string,
            CommaSeparator: t.separator,
        })
    ]
})

export const filter_language = LRLanguage.define({
    parser: parser_with_metadata,
    languageData: {
        commentTokens: { line: "#"}
    }
})

export const filter_support = new LanguageSupport(filter_language, []);

export const filter_diagnostics_source = (unsaved_changes: () => void) => {
    return (view: EditorView): readonly Diagnostic[] | Promise<readonly Diagnostic[]> => {
        const lines = view.state.sliceDoc(0).split("\n");
        const set: Diagnostic[] = [];
        unsaved_changes();
        for (let i = 0; i < lines.length; i++) {
            const x = lines[i];
            const line = i + 1;
            if (x.startsWith("#")) {
              continue;
            }

            const res = deserialize_filter(x);
            if ("type" in res) {
                const from_pos = view.state.doc.line(line).from;
                const to_pos = view.state.doc.line(line).to;
                set.push({
                    from: from_pos,
                    to: to_pos,
                    severity: "error",
                    source: "filter checker",
                    message: `${res.type.toLowerCase().split("_").join(" ")}${typeof res.description === "string" ? ` - ${res.description}` : ""}`
                });
            }
        }
        return set;
    }
}

export const filter_diagnostics = (unsaved_changes: () => void): Extension => {
    return linter(filter_diagnostics_source(unsaved_changes));
}
