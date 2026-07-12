<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import AppTextarea from '$lib/components/ui/AppTextarea.svelte';
	import FormToast from '$lib/components/ui/FormToast.svelte';
	import { toast } from 'svelte-sonner';
	import { bulkCreatePlayers } from './team.remote';

	const enhancedForm = bulkCreatePlayers.enhance(async (f) => {
		try {
			if (await f.submit()) {
				toast.success(f.result?.message ?? '選手を一括登録しました');
				bulkCreatePlayers.fields.set({ namesText: '', gender: 'unknown' });
				await invalidateAll();
			}
		} catch (e) {
			toast.error(e instanceof Error ? e.message : '一括登録に失敗しました');
		}
	});
</script>

<form {...enhancedForm} class="space-y-3">
	<FormToast result={bulkCreatePlayers.result} />
	<label class="block">
		<span class="text-xs font-medium text-muted-foreground">選手名（1行に1人）</span>
		<AppTextarea
			{...bulkCreatePlayers.fields.namesText.as('text', '')}
			rows={8}
			placeholder="山田太郎
鈴木花子
田中一郎"
			class="mt-1 font-mono text-sm"
		/>
	</label>
	<input {...bulkCreatePlayers.fields.gender.as('hidden', 'unknown')} />
	<AppButton type="submit" loading={bulkCreatePlayers.pending > 0}>一括登録</AppButton>
</form>
