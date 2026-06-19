<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import DialogCloseButton from '$lib/components/DialogCloseButton.svelte';
	import FormToast from '$lib/components/FormToast.svelte';
	import { Dialog } from 'bits-ui';
	import type { FormField, FormActionResult } from '$lib/types/forms';
	import type { SelectItem } from '$lib/types/ui';
	import { type Component } from 'svelte';
	import type { ManagedAccount } from '$lib/server/auth/accountManagement';

	let {
		open = $bindable(false),
		editAccount,
		updateAccount,
		resetPassword,
		accountTypeItems,
		accountTypeValue,
		accountTypeBadgeColor,
		accountTypeLabel,
		accountTypeIcon: AcctIcon,
		teamItems
	}: {
		open: boolean;
		editAccount: ManagedAccount | null;
		updateAccount: {
			for(id: string): {
				method: 'POST';
				action: string;
				fields: {
					userId: FormField<string>;
					name: FormField<string>;
					accountType: FormField<string>;
					teamId: FormField<string | undefined>;
				};
				result: FormActionResult | undefined;
			};
		};
		resetPassword: {
			for(id: string): {
				method: 'POST';
				action: string;
				fields: {
					userId: FormField<string>;
					password: FormField<string>;
				};
				result: FormActionResult | undefined;
			};
		};
		accountTypeItems: SelectItem[];
		accountTypeValue: (account: ManagedAccount) => string;
		accountTypeBadgeColor: (value: string) => 'red' | 'blue' | 'zinc';
		accountTypeLabel: (value: string) => string;
		accountTypeIcon: (value: string) => Component;
		teamItems: SelectItem[];
	} = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl outline-none"
		>
			{#if editAccount}
				{#key editAccount.id}
					{@const acctType = accountTypeValue(editAccount)}
					{@const Icon = AcctIcon(acctType)}
					{@const updateForm = updateAccount.for(editAccount.id)}
					{@const resetForm = resetPassword.for(editAccount.id)}

					<div class="mb-5 flex items-start justify-between gap-3">
						<div class="flex items-center gap-3">
							<div
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600"
							>
								<Icon class="h-4 w-4" />
							</div>
							<div>
								<div class="flex flex-wrap items-center gap-2">
									<Dialog.Title class="font-mono text-sm font-semibold text-zinc-950">
										{editAccount.accountId}
									</Dialog.Title>
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
								<AppInput {...updateForm.fields.name.as('text', editAccount.name)} required />
							</label>
							<div class={`grid gap-3 ${acctType === 'team' ? 'sm:grid-cols-2' : ''}`}>
								<label class="grid gap-1">
									<span class="text-xs font-medium text-zinc-600">種別</span>
									<AppSelect
										{...updateForm.fields.accountType.as('select', acctType)}
										items={accountTypeItems}
									/>
								</label>
								{#if acctType === 'team'}
									<label class="grid gap-1">
										<span class="text-xs font-medium text-zinc-600">チーム</span>
										<AppSelect
											{...updateForm.fields.teamId.as('select', editAccount.profile?.teamId ?? '')}
											items={teamItems}
										/>
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
				{/key}
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
