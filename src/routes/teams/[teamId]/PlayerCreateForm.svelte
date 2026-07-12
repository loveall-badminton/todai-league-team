<script lang="ts">
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import AppInput from '$lib/components/ui/AppInput.svelte';
	import AppSelect from '$lib/components/ui/AppSelect.svelte';
	import FormToast from '$lib/components/ui/FormToast.svelte';
	import { createPlayer } from './team.remote';
	import type { SelectItem } from '$lib/types/ui';

	let { genderItems }: { genderItems: SelectItem[] } = $props();
</script>

<form {...createPlayer} class="flex flex-wrap items-end gap-3">
	<FormToast result={createPlayer.result} />
	<div class="min-w-36 flex-1">
		<label class="block">
			<span class="text-xs font-medium text-muted-foreground">氏名 *</span>
			<AppInput
				{...createPlayer.fields.name.as('text', '')}
				required
				placeholder="例: 山田太郎"
				class="mt-1"
			/>
		</label>
	</div>
	<div class="w-28">
		<label class="block">
			<span class="text-xs font-medium text-muted-foreground">性別</span>
			<AppSelect
				{...createPlayer.fields.gender.as('select', 'unknown')}
				items={genderItems}
				class="mt-1"
			/>
		</label>
	</div>
	<AppButton type="submit">追加</AppButton>
</form>
