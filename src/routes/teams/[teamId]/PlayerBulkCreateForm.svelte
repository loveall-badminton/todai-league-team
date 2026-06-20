<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppTextarea from '$lib/components/AppTextarea.svelte';
	import FormToast from '$lib/components/FormToast.svelte';
	import type { FormInstance } from '$lib/types/forms';
	import { bulkCreatePlayersSchema } from './team.schema';

	let {
		form,
		enhancedForm
	}: {
		form: FormInstance<typeof bulkCreatePlayersSchema>;
		enhancedForm: Pick<FormInstance<typeof bulkCreatePlayersSchema>, 'method' | 'action'>;
	} = $props();

	$effect(() => {
		form.fields.set({ namesText: '', gender: 'unknown' });
	});
</script>

<form {...enhancedForm} class="space-y-3">
	<FormToast result={form.result} />
	<label class="block">
		<span class="text-xs font-medium text-zinc-500">選手名（1行に1人）</span>
		<AppTextarea
			{...form.fields.namesText.as('text')}
			rows={8}
			placeholder="山田太郎
鈴木花子
田中一郎"
			class="mt-1 font-mono text-sm"
		/>
	</label>
	<input {...form.fields.gender.as('hidden', 'unknown')} />
	<AppButton type="submit" disabled={form.pending > 0}>
		{form.pending > 0 ? '登録中…' : '一括登録'}
	</AppButton>
</form>
