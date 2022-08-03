<script lang="ts">
    import FiltersEditor from "./FiltersEditor.svelte";
    import SaveButton from "./SaveButton.svelte";

    let save_filters: (() => void);
    let has_unsaved_changes: boolean;
</script>

<main>
    <SaveButton bind:unsaved_changes={has_unsaved_changes} on:click={save_filters}></SaveButton>
    <FiltersEditor bind:save={save_filters} bind:unsaved_changes={has_unsaved_changes}></FiltersEditor>
</main>

<style>
    main {
        height: calc(100vh - 75px);
        max-height: calc(100vh - 75px);
    }
</style>