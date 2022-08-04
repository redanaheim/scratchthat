<script lang="ts">
    export let unsaved_changes: boolean;
</script>

<button on:click class="save_btn">
    <span class="invisible">*</span>Save<span class={unsaved_changes ? "" : "invisible"}>*</span>
</button>

<style>
    .invisible {
        color: transparent;
    }
</style>