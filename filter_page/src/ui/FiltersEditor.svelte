<script lang="ts">
    import { editor_val_store, filter_list_store } from "../store/state";
    import {EditorView, lineNumbers} from "@codemirror/view"
    import { filter_support, filter_diagnostics } from "../codemirror/codemirror";
    import { get_valid_lines } from "../deserialize_filter";
    import { oneDark } from "../codemirror/one_dark";
    import { onMount } from "svelte";
    import "../codemirror/cm_style.css";

    let view: EditorView;

    const CM_PARENT_ID = "cm_parent_filterseditor";
    let cm_parent: HTMLDivElement;

    export let unsaved_changes = false;
    export const save = () => {
        const valid_lines = get_valid_lines(view); 
        filter_list_store.update(() => valid_lines);
        console.log("Saved:", valid_lines);
        saved();
    };

    let initial_diagnostic_check = true;
    const previous_editor_value = $editor_val_store;

    const update_editor_content = () => {
        editor_val_store.update(() => view.state.sliceDoc());
    };

    const unsaved = () => {
        if (!initial_diagnostic_check) {
            unsaved_changes = true;
        }
        else {
            initial_diagnostic_check = false;
        }
        update_editor_content();
    }

    const saved = () => {
        unsaved_changes = false;
        update_editor_content();
    }

    onMount(() => {
        view = new EditorView({
            parent: cm_parent,
            doc: previous_editor_value,
            extensions: [filter_support, filter_diagnostics(unsaved), lineNumbers(), oneDark],
        });
    });
</script>

<div class="filters" id={CM_PARENT_ID} bind:this={cm_parent}>
</div>

<style>
    .filters {
        height: 100%;
    }
</style>