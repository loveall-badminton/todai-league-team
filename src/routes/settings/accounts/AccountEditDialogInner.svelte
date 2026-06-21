<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import DialogCloseButton from '$lib/components/DialogCloseButton.svelte';
	import FormToast from '$lib/components/FormToast.svelte';
	import type { SelectItem } from '$lib/types/ui';
	import type { Component } from 'svelte';
	import type { ManagedAccount } from '$lib/server/auth/accountManagement';
	import { updateAccount, resetPassword } from './accounts.remote';

	let {
		editAccount,
		accountTypeItems,
		accountTypeValue,
		accountTypeBadgeColor,
		accountTypeLabel,
		accountTypeIcon: AcctIcon,
		teamItems
	}: {
		editAccount: ManagedAccount;
		accountTypeItems: SelectItem[];
		accountTypeValue: (account: ManagedAccount) => string;
		accountTypeBadgeColor: (value: string) => 'red' | 'blue' | 'zinc';
		accountTypeLabel: (value: string) => string;
		accountTypeIcon: (value: string) => Component;
		teamItems: SelectItem[];
	} = $props();

	const acctType = $derived(accountTypeValue(editAccount));
	const Icon = $derived(AcctIcon(acctType));
	const updateForm = $derived(updateAccount.for(editAccount.id));
	const updateTeamId = $derived(editAccount.profile?.teamId ?? '');
	const resetForm = $derived(resetPassword.for(editAccount.id));

	$effect(() => {
		updateForm.fields.set({
			userId: editAccount.id,
			name: editAccount.name,
			accountType: acctType as 'admin' | 'participant' | 'team',
			teamId: updateTeamId
		});
	});

	$effect(() => {
		resetForm.fields.set({ userId: editAccount.id, password: '' });
	});
</script>

<div class="mb-5 flex items-start justify-between gap-3">
	<div class="flex items-center gap-3">
		<div
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600"
		>
			<Icon class="h-4 w-4" />
		</div>
		<div>
			<div class="flex flex-wrap items-center gap-2">
				<span class="font-mono text-sm font-semibold text-zinc-950">
					{editAccount.accountId}
				</span>
				<Badge color={accountTypeBadgeColor(acctType)}>
					{accountTypeLabel(acctType)}
				</Badge>
			</div>
			<p class="text-xs text-zinc-500">{editAccount.name}</p>
		</div>
	</div>
	<DialogCloseButton class="shrink-0" />
</div>

<div class="space-y-3">
	<h3 class="text-xs font-semibold tracking-wide text-zinc-400">アカウント情報</h3>
	<FormToast result={updateForm.result} />
	<form {...updateForm} class="space-y-3">
		<input {...updateForm.fields.userId.as('hidden', editAccount.id)} />
		<label class="grid gap-1">
			<span class="text-xs font-medium text-zinc-600">表示名</span>
			<AppInput {...updateForm.fields.name.as('text')} required />
		</label>
		<div class={`grid gap-3 ${acctType === 'team' ? 'sm:grid-cols-2' : ''}`}>
			<label class="grid gap-1">
				<span class="text-xs font-medium text-zinc-600">種別</span>
				<AppSelect {...updateForm.fields.accountType.as('select')} items={accountTypeItems} />
			</label>
			{#if acctType === 'team'}
				<label class="grid gap-1">
					<span class="text-xs font-medium text-zinc-600">チーム</span>
					<AppSelect {...updateForm.fields.teamId.as('select')} items={teamItems} />
				</label>
			{/if}
		</div>
		<div class="flex justify-end pt-1">
			<AppButton type="submit">保存</AppButton>
		</div>
	</form>
</div>

<div class="my-5 border-t border-zinc-100"></div>

<div class="space-y-3">
	<h3 class="text-xs font-semibold tracking-wide text-zinc-400">パスワード変更</h3>
	<FormToast result={resetForm.result} />
	<form {...resetForm} class="space-y-3">
		<input {...resetForm.fields.userId.as('hidden', editAccount.id)} />
		<label class="grid gap-1">
			<span class="text-xs font-medium text-zinc-600">新しいパスワード</span>
			<AppInput
				{...resetForm.fields.password.as('password')}
				autocomplete="new-password"
				required
			/>
		</label>
		<div class="flex justify-end pt-1">
			<AppButton type="submit">変更</AppButton>
		</div>
	</form>
</div>
