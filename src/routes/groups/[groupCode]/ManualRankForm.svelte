<script lang="ts">
	import AppInput from '$lib/components/AppInput.svelte';
	import type { ScopedForm } from '$lib/types/forms';
	import { setManualRankSchema } from './group.schema';

	let {
		form,
		teamId,
		manualRank
	}: {
		form: ScopedForm<typeof setManualRankSchema>;
		teamId: string;
		manualRank: number;
	} = $props();

	$effect(() => {
		form.fields.set({
			teamId,
			manualRank: String(manualRank),
			reason: ''
		});
	});
</script>

<form {...form} class="flex items-center gap-2">
	<input {...form.fields.teamId.as('hidden', '')} />
	<AppInput
		type="number"
		{...form.fields.manualRank.as('text')}
		min="1"
		class="w-14 px-2 py-1.5 tabular-nums"
	/>
	<AppInput {...form.fields.reason.as('text')} placeholder="理由" class="w-24 px-2 py-1.5" />
	<button
		type="submit"
		class="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
	>
		保存
	</button>
</form>
