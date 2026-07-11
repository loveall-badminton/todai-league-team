<script lang="ts">
	import { Dialog } from 'bits-ui';
	import AccountTypeBadge from '$lib/components/AccountTypeBadge.svelte';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import DialogCloseButton from '$lib/components/DialogCloseButton.svelte';
	import FormToast from '$lib/components/FormToast.svelte';
	import type { SelectItem } from '$lib/types/ui';
	import type { ManagedAccount } from '$lib/server/auth/accountManagement';
	import { updateAccount, resetPassword } from './accounts.remote';
	import { accountTypeValue, accountTypeIcon } from './accounts.helpers';

	let {
		open = $bindable(false),
		editAccount,
		accountTypeItems,
		teamItems
	}: {
		open: boolean;
		editAccount: ManagedAccount | null;
		accountTypeItems: SelectItem[];
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
					{@const Icon = accountTypeIcon(acctType)}

					<div class="mb-5 flex items-start justify-between gap-3">
						<div class="flex items-center gap-3">
							<div
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-muted-emphasis"
							>
								<Icon class="h-4 w-4" />
							</div>
							<div>
								<div class="flex flex-wrap items-center gap-2">
									<span class="font-mono text-sm font-semibold text-default">
										{editAccount.accountId}
									</span>
									<AccountTypeBadge accountType={acctType} />
								</div>
								<p class="text-xs text-muted-foreground">{editAccount.name}</p>
							</div>
						</div>
						<DialogCloseButton class="shrink-0" />
					</div>

					<div class="space-y-3">
						<h3 class="text-xs font-semibold tracking-wide text-muted">アカウント情報</h3>
						<FormToast result={updateAccount.result} />
						<form {...updateAccount} class="space-y-3">
							<input {...updateAccount.fields.userId.as('hidden', editAccount.id)} />
							<label class="grid gap-1">
								<span class="text-xs font-medium text-muted-emphasis">表示名</span>
								<AppInput {...updateAccount.fields.name.as('text', editAccount.name)} required />
							</label>
							<div class={`grid gap-3 ${acctType === 'team' ? 'sm:grid-cols-2' : ''}`}>
								<label class="grid gap-1">
									<span class="text-xs font-medium text-muted-emphasis">種別</span>
									<AppSelect
										{...updateAccount.fields.accountType.as('select', acctType)}
										items={accountTypeItems}
									/>
								</label>
								{#if acctType === 'team'}
									<label class="grid gap-1">
										<span class="text-xs font-medium text-muted-emphasis">チーム</span>
										<AppSelect
											{...updateAccount.fields.teamId.as(
												'select',
												editAccount.profile?.teamId ?? ''
											)}
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

					<div class="my-5 border-t border-border-subtle"></div>

					<div class="space-y-3">
						<h3 class="text-xs font-semibold tracking-wide text-muted">パスワード変更</h3>
						<FormToast result={resetPassword.result} />
						<form {...resetPassword} class="space-y-3">
							<input {...resetPassword.fields.userId.as('hidden', editAccount.id)} />
							<label class="grid gap-1">
								<span class="text-xs font-medium text-muted-emphasis">新しいパスワード</span>
								<AppInput
									{...resetPassword.fields.password.as('password')}
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
