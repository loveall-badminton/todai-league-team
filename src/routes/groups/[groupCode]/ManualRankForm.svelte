<script lang="ts">
	import AppInput from '$lib/components/ui/AppInput.svelte';
	import { setManualRank } from './group.remote';

	let {
		teamId,
		manualRank
	}: {
		teamId: string;
		manualRank: number;
	} = $props();

	const form = $derived(setManualRank.for(teamId));
</script>

<form {...form} class="flex items-center gap-2">
	<input {...form.fields.teamId.as('hidden', teamId)} />
	<AppInput
		type="number"
		{...form.fields.manualRank.as('text', String(manualRank))}
		min="1"
		class="w-14 px-2 py-1.5 tabular-nums"
	/>
	<AppInput {...form.fields.reason.as('text', '')} placeholder="理由" class="w-24 px-2 py-1.5" />
	<button
		type="submit"
		class="rounded-xl border border-border bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
	>
		保存
	</button>
</form>
