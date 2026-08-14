<script lang="ts">
	import AppButton from '../AppButton.svelte';

	let {
		loading = false,
		label = 'Save'
	}: {
		loading?: boolean;
		label?: string;
	} = $props();
</script>

<AppButton {loading}>{label}</AppButton>
