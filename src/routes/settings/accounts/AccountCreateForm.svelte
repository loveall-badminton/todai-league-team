<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import FormToast from '$lib/components/FormToast.svelte';
	import type { SelectItem } from '$lib/types/ui';
	import type { FormField, FormActionResult } from '$lib/types/forms';

	/* eslint-disable svelte/no-unused-props -- method/action used via {...form} spread */
	let {
		form,
		accountTypeItems,
		teamItems
	}: {
		form: {
			method: 'POST';
			action: string;
			fields: {
				accountType: FormField<string | undefined>;
				accountId: FormField<string | undefined>;
				name: FormField<string | undefined>;
				password: FormField<string | undefined>;
				teamId: FormField<string | undefined>;
			};
			result: FormActionResult | undefined;
		};
		accountTypeItems: SelectItem[];
		teamItems: SelectItem[];
	} = $props();
	/* eslint-enable svelte/no-unused-props */
</script>

<h2 class="mb-4 font-semibold text-zinc-950">アカウント発行</h2>
<FormToast result={form.result} />
<form {...form} class="space-y-4">
	<div class="grid gap-4 sm:grid-cols-2">
		<label class="grid gap-1">
			<span class="text-sm font-medium text-zinc-700">種別</span>
			<AppSelect
				{...form.fields.accountType.as('select')}
				items={accountTypeItems}
				onValueChange={(v: string) =>
					form.fields.accountType.set(v as 'participant' | 'team' | 'admin')}
			/>
		</label>
		{#if form.fields.accountType.value() === 'team'}
			<label class="grid gap-1">
				<span class="text-sm font-medium text-zinc-700">チーム</span>
				<AppSelect {...form.fields.teamId.as('select')} items={teamItems} required />
			</label>
		{/if}
	</div>

	<div class="grid gap-4 sm:grid-cols-3">
		<label class="grid gap-1">
			<span class="text-sm font-medium text-zinc-700">ID</span>
			<AppInput {...form.fields.accountId.as('text')} autocomplete="username" required />
		</label>
		<label class="grid gap-1">
			<span class="text-sm font-medium text-zinc-700">表示名</span>
			<AppInput {...form.fields.name.as('text')} required />
		</label>
		<label class="grid gap-1">
			<span class="text-sm font-medium text-zinc-700">パスワード</span>
			<AppInput {...form.fields.password.as('password')} autocomplete="new-password" required />
		</label>
	</div>

	<div class="flex justify-end border-t border-zinc-100 pt-4">
		<AppButton type="submit">発行</AppButton>
	</div>
</form>
