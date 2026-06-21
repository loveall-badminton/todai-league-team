<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import { create } from './teams.remote';
	import type { SelectItem } from '$lib/types/ui';

	let {
		groupCodeItems,
		onCancel
	}: {
		groupCodeItems: SelectItem[];
		onCancel: () => void;
	} = $props();

	$effect(() => {
		create.fields.set({ name: '', shortName: '', groupCode: '' });
	});
</script>

<form {...create} class="space-y-4">
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<div class="lg:col-span-2">
			<label class="block">
				<span class="text-xs font-medium tracking-wide text-zinc-500">チーム名 *</span>
				<AppInput
					{...create.fields.name.as('text')}
					required
					placeholder="例: 東京大学"
					class="mt-1"
				/>
			</label>
		</div>
		<div>
			<label class="block">
				<span class="text-xs font-medium tracking-wide text-zinc-500">略称</span>
				<AppInput {...create.fields.shortName.as('text')} placeholder="例: 東大" class="mt-1" />
			</label>
		</div>
		<div>
			<label class="block">
				<span class="text-xs font-medium tracking-wide text-zinc-500">リーグ</span>
				<AppSelect
					{...create.fields.groupCode.as('select')}
					items={groupCodeItems}
					placeholder="未割当"
					class="mt-1"
				/>
			</label>
		</div>
	</div>
	<div class="flex gap-2">
		<AppButton type="submit">追加</AppButton>
		<AppButton type="button" variant="secondary" onclick={onCancel}>キャンセル</AppButton>
	</div>
</form>
