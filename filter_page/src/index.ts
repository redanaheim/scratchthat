import {EditorView, lineNumbers} from "@codemirror/view"
import { filter_support, filter_diagnostics } from "./codemirror";
import { get_valid_lines } from "./deserialize_filter";
import { oneDark } from "./one_dark";
import type { Browser } from "./state";

declare const browser: Browser;

const setup_filter_editor = async (element: HTMLElement) => {
    const previous_editor_value = await browser.storage.local.get("editor_val");

    const current_val = ((typeof previous_editor_value["editor_val"]) === "string") ? previous_editor_value["editor_val"] as string : ""

    const update_editor_content = () => {
        browser.storage.local.set({
            editor_val: view.state.sliceDoc(0)
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
        parent: element,
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
}

window.addEventListener("DOMContentLoaded", async () => {
    await setup_filter_editor(document.getElementById("filters"));
});
