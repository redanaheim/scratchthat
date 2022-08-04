<script lang="ts">
    import { EDITING_FILTER } from "@svelte-app/store/state";
    import { named_list_store } from "@svelte-app/store/state";

    export let editing: string = EDITING_FILTER;
</script>

<select id="editing" bind:value={editing}>
    <option value={EDITING_FILTER}>
        Filter List
    </option>
    {#each Object.keys($named_list_store) as list_name}
        <option value={list_name}>
            {list_name}
        </option>
    {/each}
</select>