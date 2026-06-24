<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import FormToast from '$lib/components/FormToast.svelte';
	import type { SelectItem } from '$lib/types/ui';
	import { createAccount } from './accounts.remote';

	let {
		accountTypeItems,
		teamItems
	}: {
		accountTypeItems: SelectItem[];
		teamItems: SelectItem[];
	} = $props();

	let accountType = $state('participant');
</script>

<FormToast result={createAccount.result} />
<form {...createAccount} class="space-y-4">
	<div class="grid gap-4 sm:grid-cols-2">
		<label class="grid gap-1">
			<span class="text-sm font-medium text-zinc-700">種別</span>
			<AppSelect
				{...createAccount.fields.accountType.as('select', 'participant')}
				items={accountTypeItems}
				onValueChange={(value) => {
					accountType = value;
				}}
			/>
		</label>
		{#if accountType === 'team'}
			<label class="grid gap-1">
				<span class="text-sm font-medium text-zinc-700">チーム</span>
				<AppSelect {...createAccount.fields.teamId.as('select')} items={teamItems} required />
			</label>
		{/if}
	</div>

	<div class="grid gap-4 sm:grid-cols-3">
		<label class="grid gap-1">
			<span class="text-sm font-medium text-zinc-700">ID</span>
			<AppInput {...createAccount.fields.accountId.as('text')} autocomplete="username" required />
		</label>
		<label class="grid gap-1">
			<span class="text-sm font-medium text-zinc-700">表示名</span>
			<AppInput {...createAccount.fields.name.as('text')} required />
		</label>
		<label class="grid gap-1">
			<span class="text-sm font-medium text-zinc-700">パスワード</span>
			<AppInput
				{...createAccount.fields.password.as('password')}
				autocomplete="new-password"
				required
			/>
		</label>
	</div>

	<div class="flex justify-end border-t border-border-subtle pt-4">
		<AppButton type="submit">発行</AppButton>
	</div>
</form>
