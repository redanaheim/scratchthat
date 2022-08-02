import {EditorView, lineNumbers} from "@codemirror/view"
import { filter_support, filter_diagnostics } from "./codemirror";
import { get_valid_lines } from "./deserialize_filter";
import { oneDark } from "./one_dark";
import type { Browser } from "./state";

declare const browser: Browser;

let named_lists: Record<string, string[]> = {};

const get_named_lists = async () => {
    const res = (await browser.storage.local.get("named_lists"))["named_lists"];
    if (typeof res !== "object") {
        named_lists = {};
    }
    else {
        named_lists = res;
    }
}

const save_named_lists = async (): Promise<void> => {
    await browser.storage.local.set({
        named_lists
    });
};

/*
const filters_option = (() => {
    let el = document.createElement("option");
    el.value = "0";
    el.innerText = "List of Filters";
})()
*/

const fill_list_editing_options = (select: HTMLSelectElement) => {
    let present: string[] = [];
    select.childNodes.forEach(x => {
        const val = (x as HTMLOptionElement).value;
        if (val === "0") return;
        if (Object.keys(named_lists).includes(val) === false) select.removeChild(x);
        else present.push(val);
    });
    for (let key in named_lists) {
        if (present.includes(key)) continue;
        let el = document.createElement("option");
        el.value = key;
        el.innerText = key;
        select.appendChild(el);
    }
}

const add_list = async (name: string): Promise<void> => {
    named_lists[name] = [];
    await save_named_lists();
}
const remove_list = async (name: string): Promise<void> => {
    if (name in named_lists) {
        delete named_lists[name];
    }
    await save_named_lists();
}

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
    const filters_div = document.getElementById("filters");
    const editing_selector = document.getElementById("editing") as HTMLSelectElement;
    const filter_list_option = document.getElementById("filter_list");
    const add_button = document.getElementById("add");
    const remove_button = document.getElementById("remove");

    await get_named_lists();
    fill_list_editing_options(editing_selector);

    add_button.onclick = async () => {
        await add_list("unnamed_list");
        fill_list_editing_options(editing_selector);
    };

    remove_button.onclick = async () => {
        if (editing_selector.value === "0") {
            return;
        }
        await remove_list(editing_selector.value);
        fill_list_editing_options(editing_selector);
    }

    await setup_filter_editor(document.getElementById("filters"));
});
