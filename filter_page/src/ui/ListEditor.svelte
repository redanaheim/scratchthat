<script lang="ts">
    import { editor_val_store, named_list_store } from "../store/state";
    import {EditorView, lineNumbers, ViewUpdate} from "@codemirror/view"
    import { list_content_updates } from "../codemirror/codemirror";
    import { oneDark } from "../codemirror/one_dark";
    import { onMount } from "svelte";
    import "../codemirror/cm_style.css";
    import { except_key } from "@svelte-app/util/util";

    let view: EditorView;

    const CM_PARENT_ID = "cm_parent_listeditor";
    let cm_parent: HTMLDivElement;
    export let editing: string;

    $: {
        if (view !== undefined) {
            view.destroy();
            view = create_view(editing);
        }
    }

    export let saved_status_text: string = "Saved";

    const save = () => {
        saved_status_text = "Saving...";
        const new_val = view.state.sliceDoc(0).split("\n");
        named_list_store.update(prev_val => {
            return except_key(prev_val, editing, (cur, _prev) => { cur[editing] = new_val })
        });
        saved();
    };

    const previous_editor_value = $editor_val_store;

    const changed = () => {
        saved_status_text = "Editing...";
    }

    const saved = () => {
        saved_status_text = "Saved";
    }

    const update_listener = (update: ViewUpdate) => {
        if (update.docChanged) changed();
    }

    const create_view = (editing_name: string) => {
        return new EditorView({
            parent: cm_parent,
            doc: $named_list_store[editing_name].join("\n"),
            extensions: [list_content_updates(save), lineNumbers(), oneDark, EditorView.updateListener.of(update_listener)],
        });
    }

    onMount(() => {
        view = create_view(editing);
    });
</script>

<div class="list" id={CM_PARENT_ID} bind:this={cm_parent}>
</div>

<style>
    .list {
        height: 100%;
    }
</style>