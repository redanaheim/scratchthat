declare const browser: {
    storage: {
        local: {
            get: (keys: string[] | string) => Promise<{ [key: string]: unknown }>,
            set: (obj: { [key: string]: any }) => Promise<unknown>,
        }
    }
}

import {EditorView, lineNumbers} from "@codemirror/view"
import { filter_support, filter_diagnostics } from "./codemirror";
import { oneDark } from "./one_dark";
import { Filter, deserialize_filter } from "./deserialize_filter"; 

const get_valid_lines = (view: EditorView): Filter[] => {
    const lines = view.state.sliceDoc(0).split("\n");
    let valid: Filter[] = [];
    for (let i = 0; i < lines.length; i++) {
        let res = deserialize_filter(lines[i]);
        if ("type" in res) {
            continue;
        }
        else {
            valid.push(res);
        }
    }
    return valid;
};

window.addEventListener("DOMContentLoaded", async () => {

    const previous_editor_value = await browser.storage.local.get("editor_val");

    const current_val = ((typeof previous_editor_value["editor_val"]) === "string") ? previous_editor_value["editor_val"] as string : ""

    const update_editor_content = () => {
        browser.storage.local.set({
            "editor_val": view.state.sliceDoc(0)
        }).then(() => {
            console.log("Updated editor content...");
        });
    };

    const unsaved = () => {
        unsaved_changes.classList.remove("invisible");
        update_editor_content();
    }

    const saved = () => {
        unsaved_changes.classList.add("invisible");
        update_editor_content();
    }

    const view = new EditorView({
        parent: document.getElementById("filters"),
        doc: current_val,
        extensions: [filter_support, filter_diagnostics(unsaved), lineNumbers(), oneDark],
    })

    const save_btn = document.getElementById("save");
    const unsaved_changes = document.getElementById("unsaved_changes");

    save_btn.onclick = async () => {
        const valid_lines = get_valid_lines(view); 
        await browser.storage.local.set({
            filters: valid_lines
        });
        console.log("Saved:", valid_lines);
        saved();
    };
});
