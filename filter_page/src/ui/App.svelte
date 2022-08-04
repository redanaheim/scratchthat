<script lang="ts">
import { LIST_NAME_REGEX } from "@svelte-app/deserialize_filter";

    import { add_list, remove_list as remove_list_gen, rename_list as rename_list_gen } from "@svelte-app/util/lists";

    import { EDITING_FILTER, named_list_store } from "@svelte-app/store/state";
    import EditingSelector from "./EditingSelector.svelte";

    import FiltersEditor from "./FiltersEditor.svelte";
    import SaveButton from "./SaveButton.svelte";
    import ListEditor from "./ListEditor.svelte";

    let save_filters: (() => void);
    let has_unsaved_changes: boolean;
    let list_save_status: string;
    let editing: string;
    let remove_list = remove_list_gen(() => editing, val => { editing = val });
    let rename_list = rename_list_gen(() => editing, val => { editing = val });

    let renaming = false;
    let rename_value = "";
    let rename_input: HTMLInputElement;

    let start_renaming = () => {
        renaming = true;
        rename_value = editing;
    }

    let focus = (el: HTMLInputElement | null | undefined) => {
        if (el === null || el === undefined) return;
        el.focus();
        el.select();
    }

    // On rename_change, focus it (it is a conditional element so sometimes this variable is null when it's hidden)
    // So this is basically saying focus the input when it's shown
    $: focus(rename_input);

    // Derived from rename_value
    $: validated_newname = LIST_NAME_REGEX.test(rename_value) && ((rename_value === editing) || !(rename_value in $named_list_store));

    let done_renaming = () => {
        if (rename_value !== editing) {
            rename_list(rename_value);
        }
        renaming = false;
        rename_value = "";
    };

    let search: () => void;
</script>

<main>
    <table>
        <tr>
            <td class="min">
                List:
            </td>
            <td class="min">
                <button on:click={add_list}>
                    +
                </button>
            </td>
            <td class="min">
                <button on:click={remove_list} disabled={editing === EDITING_FILTER ? true : false}>
                    -
                </button>
            </td>
            <td class="min">
                <button on:click={start_renaming} disabled={editing === EDITING_FILTER ? true : false}>
                    Rename
                </button>
            </td>
            <td class="max" style="text-align: center;">
                Editing 
                {#if renaming}
                    <input bind:value={rename_value} bind:this={rename_input}/>
                    <button on:click={done_renaming} disabled={validated_newname === false}>
                        Done
                    </button>
                {/if}
                {#if renaming === false}
                    <EditingSelector bind:editing={editing}></EditingSelector>
                    <button on:click={search}>
                        Search
                    </button>
                {/if}
            </td>
            <td class="min">
                {#if editing === EDITING_FILTER}
                    <SaveButton bind:unsaved_changes={has_unsaved_changes} on:click={save_filters}></SaveButton>
                {/if}
                {#if editing !== EDITING_FILTER}
                    <button class="save_btn">{list_save_status}</button>
                {/if}
            </td>
        </tr>
    </table>
    {#if editing === EDITING_FILTER}
        <FiltersEditor bind:open_search_panel={search} bind:save={save_filters} bind:unsaved_changes={has_unsaved_changes}></FiltersEditor>
    {/if}
    {#if editing !== EDITING_FILTER}
        <ListEditor bind:open_search_panel={search} bind:saved_status_text={list_save_status} bind:editing={editing}></ListEditor>
    {/if}
</main>

<style>
    main {
        height: calc(100vh - 75px);
        max-height: calc(100vh - 75px);
    }

    td.min {
        width: max-content;
        word-break: keep-all;
    }

    td.max {
        width: 100%;
    }
</style>