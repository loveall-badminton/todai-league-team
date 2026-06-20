<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import FormToast from '$lib/components/FormToast.svelte';
	import type { FormInstance } from '$lib/types/forms';
	import { createPlayerSchema } from './team.schema';
	import type { SelectItem } from '$lib/types/ui';

	let {
		form,
		genderItems
	}: {
		form: FormInstance<typeof createPlayerSchema>;
		genderItems: SelectItem[];
	} = $props();

	$effect(() => {
		form.fields.set({ name: '', gender: 'unknown' });
	});
</script>

<form {...form} class="flex flex-wrap items-end gap-3">
	<FormToast result={form.result} />
	<div class="min-w-36 flex-1">
		<label class="block">
			<span class="text-xs font-medium text-zinc-500">氏名 *</span>
			<AppInput {...form.fields.name.as('text')} required placeholder="例: 山田太郎" class="mt-1" />
		</label>
	</div>
	<div class="w-28">
		<label class="block">
			<span class="text-xs font-medium text-zinc-500">性別</span>
			<AppSelect {...form.fields.gender.as('select')} items={genderItems} class="mt-1" />
		</label>
	</div>
	<AppButton type="submit">追加</AppButton>
</form>
