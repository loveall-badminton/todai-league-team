<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Card from '$lib/components/Card.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import DialogCloseButton from '$lib/components/DialogCloseButton.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FormToast from '$lib/components/FormToast.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { Pencil, ShieldCheck, UserRound, UsersRound } from '@lucide/svelte';
	import { Dialog } from 'bits-ui';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { PageProps } from './$types';
	import { createAccount, deleteAccount, resetPassword, updateAccount } from './accounts.remote';

	let { data }: PageProps = $props();

	const accountTypeItems = [
		{ value: 'participant', label: '一般参加者' },
		{ value: 'team', label: 'チーム' },
		{ value: 'admin', label: '運営' }
	];
	let teamItems = $derived(data.teams.map((team) => ({ value: team.id, label: team.name })));

	onMount(() => {
		createAccount.fields.set({
			accountType: 'participant',
			accountId: '',
			name: '',
			password: '',
			teamId: data.teams[0]?.id ?? ''
		});
	});

	function accountTypeValue(account: PageProps['data']['accounts'][number]) {
		if (account.profile?.accountType) return account.profile.accountType;
		return account.role === 'admin' ? 'admin' : 'participant';
	}

	function accountTypeLabel(value: string) {
		if (value === 'admin') return '運営';
		if (value === 'team') return 'チーム';
		return '一般参加者';
	}

	function accountTypeBadgeColor(value: string): 'red' | 'blue' | 'zinc' {
		if (value === 'admin') return 'red';
		if (value === 'team') return 'blue';
		return 'zinc';
	}

	function accountTypeIcon(value: string) {
		if (value === 'admin') return ShieldCheck;
		if (value === 'team') return UsersRound;
		return UserRound;
	}

	function teamName(teamId: string | null | undefined) {
		return data.teams.find((team) => team.id === teamId)?.name ?? '';
	}

	let editOpen = $state(false);
	let editAccountId = $state<string | null>(null);
	let editAccount = $derived(data.accounts.find((a) => a.id === editAccountId) ?? null);

	function openEdit(id: string) {
		editAccountId = id;
		editOpen = true;
	}
</script>

<svelte:head>
	<title>ユーザー管理 | 東大リーグ団体戦</title>
</svelte:head>

{#snippet headerActions()}
	<AppButton variant="secondary" href={resolve('/settings')}>設定へ戻る</AppButton>
{/snippet}

<PageHeader eyebrow="設定" title="ユーザー管理" actions={headerActions} />

<Card>
	<h2 class="mb-4 font-semibold text-zinc-950">アカウント発行</h2>
	<FormToast result={createAccount.result} />
	<form {...createAccount} class="space-y-4">
		<div class="grid gap-4 sm:grid-cols-2">
			<label class="grid gap-1">
				<span class="text-sm font-medium text-zinc-700">種別</span>
				<AppSelect
					{...createAccount.fields.accountType.as('select')}
					items={accountTypeItems}
					onValueChange={(v) =>
						createAccount.fields.accountType.set(v as 'participant' | 'team' | 'admin')}
				/>
			</label>
			{#if createAccount.fields.accountType.value() === 'team'}
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

		<div class="flex justify-end border-t border-zinc-100 pt-4">
			<AppButton type="submit">発行</AppButton>
		</div>
	</form>
</Card>

<section class="space-y-4">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 class="font-semibold text-zinc-950">発行済みアカウント</h2>
			<p class="mt-1 text-sm text-zinc-500">ログインID、権限、チーム紐づけを一覧で確認できます。</p>
		</div>
	</div>

	{#if data.accounts.length}
		<Card class="overflow-hidden p-0">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
						<th class="px-4 py-2.5 text-left font-medium">アカウント</th>
						<th class="hidden px-4 py-2.5 text-left font-medium sm:table-cell">種別</th>
						<th class="hidden px-4 py-2.5 text-left font-medium md:table-cell">チーム</th>
						<th class="px-4 py-2.5 text-right font-medium">操作</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-zinc-100">
					{#each data.accounts as account (account.id)}
						{@const accountType = accountTypeValue(account)}
						{@const AccountIcon = accountTypeIcon(accountType)}
						<tr class="hover:bg-zinc-50/60">
							<td class="px-4 py-3">
								<div class="flex items-center gap-2.5">
									<div
										class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500"
									>
										<AccountIcon class="h-3.5 w-3.5" />
									</div>
									<div class="min-w-0">
										<p class="truncate font-mono text-sm font-semibold text-zinc-950">
											{account.accountId}
										</p>
										<p class="truncate text-xs text-zinc-500">{account.name}</p>
									</div>
								</div>
							</td>
							<td class="hidden px-4 py-3 sm:table-cell">
								<Badge color={accountTypeBadgeColor(accountType)}>
									{accountTypeLabel(accountType)}
								</Badge>
							</td>
							<td class="hidden px-4 py-3 md:table-cell">
								<span class="text-xs text-zinc-600">{teamName(account.profile?.teamId) || '—'}</span
								>
							</td>
							<td class="px-4 py-3">
								<div class="flex items-center justify-end gap-3">
									<AppButton variant="secondary" size="sm" onclick={() => openEdit(account.id)}>
										<Pencil class="h-3.5 w-3.5" />
										編集
									</AppButton>
									<ConfirmDialog
										onConfirm={async () => {
											try {
												await deleteAccount({ userId: account.id });
												await invalidateAll();
												toast.success('アカウントを削除しました');
											} catch (e) {
												toast.error(
													e instanceof Error ? e.message : 'アカウントの削除に失敗しました'
												);
											}
										}}
										triggerLabel="削除"
										triggerClass="text-xs text-red-500 hover:text-red-700 hover:underline"
										triggerVariant="ghost"
										title="アカウントを削除しますか"
										description={`${account.accountId} はログインできなくなります。`}
										confirmVariant="danger"
										confirmLabel="削除する"
									/>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</Card>
	{:else}
		<EmptyState message="アカウントはまだありません。" />
	{/if}
</section>

<!-- Edit Dialog -->
<Dialog.Root bind:open={editOpen}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl outline-none"
		>
			{#if editAccount}
				{#key editAccountId}
					{@const accountType = accountTypeValue(editAccount)}
					{@const AccountIcon = accountTypeIcon(accountType)}
					{@const updateAccountForm = updateAccount.for(editAccount.id)}
					{@const resetPasswordForm = resetPassword.for(editAccount.id)}

					<div class="mb-5 flex items-start justify-between gap-3">
						<div class="flex items-center gap-3">
							<div
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600"
							>
								<AccountIcon class="h-4 w-4" />
							</div>
							<div>
								<div class="flex flex-wrap items-center gap-2">
									<Dialog.Title class="font-mono text-sm font-semibold text-zinc-950">
										{editAccount.accountId}
									</Dialog.Title>
									<Badge color={accountTypeBadgeColor(accountType)}>
										{accountTypeLabel(accountType)}
									</Badge>
								</div>
								<p class="text-xs text-zinc-500">{editAccount.name}</p>
							</div>
						</div>
						<DialogCloseButton class="shrink-0" />
					</div>

					<!-- Account info -->
					<div class="space-y-3">
						<h3 class="text-xs font-semibold tracking-wide text-zinc-400">アカウント情報</h3>
						<FormToast result={updateAccountForm.result} />
						<form {...updateAccountForm} class="space-y-3">
							<input {...updateAccountForm.fields.userId.as('hidden', editAccount.id)} />
							<label class="grid gap-1">
								<span class="text-xs font-medium text-zinc-600">表示名</span>
								<AppInput
									{...updateAccountForm.fields.name.as('text', editAccount.name)}
									required
								/>
							</label>
							<div class={`grid gap-3 ${accountType === 'team' ? 'sm:grid-cols-2' : ''}`}>
								<label class="grid gap-1">
									<span class="text-xs font-medium text-zinc-600">種別</span>
									<AppSelect
										{...updateAccountForm.fields.accountType.as('select', accountType)}
										items={accountTypeItems}
									/>
								</label>
								{#if accountType === 'team'}
									<label class="grid gap-1">
										<span class="text-xs font-medium text-zinc-600">チーム</span>
										<AppSelect
											{...updateAccountForm.fields.teamId.as(
												'select',
												editAccount.profile?.teamId ?? data.teams[0]?.id ?? ''
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

					<div class="my-5 border-t border-zinc-100"></div>

					<!-- Password reset -->
					<div class="space-y-3">
						<h3 class="text-xs font-semibold tracking-wide text-zinc-400">パスワード変更</h3>
						<FormToast result={resetPasswordForm.result} />
						<form {...resetPasswordForm} class="space-y-3">
							<input {...resetPasswordForm.fields.userId.as('hidden', editAccount.id)} />
							<label class="grid gap-1">
								<span class="text-xs font-medium text-zinc-600">新しいパスワード</span>
								<AppInput
									{...resetPasswordForm.fields.password.as('password')}
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
