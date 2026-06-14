<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import type { PageProps } from './$types';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FormToast from '$lib/components/FormToast.svelte';
	import AppButton from '$lib/components/AppButton.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import DeleteConfirmDialog from '$lib/components/DeleteConfirmDialog.svelte';
	import { toast } from 'svelte-sonner';
	import { createAccount, updateAccount, resetPassword, deleteAccount } from './accounts.remote';

	let { data }: PageProps = $props();

	$effect(() => {
		if (createAccount.result?.message) toast.success(createAccount.result.message);
	});

	const accountTypeItems = [
		{ value: 'participant', label: '一般参加者' },
		{ value: 'team', label: 'チーム' },
		{ value: 'admin', label: '運営' }
	];
	let teamItems = $derived(data.teams.map((team) => ({ value: team.id, label: team.name })));

	let newAccountType = $state('participant');

	function accountTypeValue(account: PageProps['data']['accounts'][number]) {
		if (account.profile?.accountType) return account.profile.accountType;
		return account.role === 'admin' ? 'admin' : 'participant';
	}

	function accountTypeLabel(value: string) {
		if (value === 'admin') return '運営';
		if (value === 'team') return 'チーム';
		return '一般参加者';
	}

	function teamName(teamId: string | null | undefined) {
		return data.teams.find((team) => team.id === teamId)?.name ?? '';
	}
</script>

<svelte:head>
	<title>ユーザー管理 | 東大リーグ団体戦</title>
</svelte:head>

{#snippet headerActions()}
	<AppButton variant="secondary" href={resolve('/settings')}>設定へ戻る</AppButton>
{/snippet}

<PageHeader eyebrow="設定" title="ユーザー管理" actions={headerActions} />

<section class="rounded-xl border border-zinc-200 bg-white p-5">
	<h2 class="mb-4 font-semibold text-zinc-900">アカウント発行</h2>
	<form {...createAccount} class="space-y-4">
		<div class="grid gap-4 sm:grid-cols-2">
			<label class="grid gap-1">
				<span class="text-sm font-medium text-zinc-700">種別</span>
				<AppSelect name="accountType" bind:value={newAccountType} items={accountTypeItems} />
			</label>
			{#if newAccountType === 'team'}
				<label class="grid gap-1">
					<span class="text-sm font-medium text-zinc-700">チーム</span>
					<AppSelect name="teamId" value={data.teams[0]?.id ?? ''} items={teamItems} required />
				</label>
			{/if}
		</div>

		<div class="grid gap-4 sm:grid-cols-3">
			<label class="grid gap-1">
				<span class="text-sm font-medium text-zinc-700">ID</span>
				<AppInput name="accountId" type="text" autocomplete="username" required />
			</label>
			<label class="grid gap-1">
				<span class="text-sm font-medium text-zinc-700">表示名</span>
				<AppInput name="name" required />
			</label>
			<label class="grid gap-1">
				<span class="text-sm font-medium text-zinc-700">パスワード</span>
				<AppInput name="password" type="password" autocomplete="new-password" required />
			</label>
		</div>

		<div class="flex justify-end border-t border-zinc-100 pt-4">
			<AppButton type="submit">発行</AppButton>
		</div>
	</form>
</section>

<section class="space-y-3">
	<div class="flex items-center justify-between">
		<h2 class="font-semibold text-zinc-900">発行済みアカウント</h2>
		<p class="text-sm text-zinc-500">{data.accounts.length}件</p>
	</div>

	{#each data.accounts as account (account.id)}
		{@const updateAccountForm = updateAccount.for(account.id)}
		{@const resetPasswordForm = resetPassword.for(account.id)}
		<div class="rounded-xl border border-zinc-200 bg-white p-5">
			<div class="mb-4 flex flex-wrap items-start justify-between gap-3">
				<div>
					<p class="font-mono text-sm font-semibold text-zinc-950">{account.accountId}</p>
					<p class="mt-1 text-sm text-zinc-500">
						{accountTypeLabel(accountTypeValue(account))}
						{#if account.profile?.teamId}
							<span class="mx-1">/</span>{teamName(account.profile.teamId)}
						{/if}
					</p>
				</div>
				<DeleteConfirmDialog
					onConfirm={async () => {
						try {
							await deleteAccount({ userId: account.id });
							await invalidateAll();
							toast.success('アカウントを削除しました');
						} catch (e) {
							toast.error(e instanceof Error ? e.message : 'アカウントの削除に失敗しました');
						}
					}}
					triggerLabel="削除"
					title="アカウントを削除しますか"
					description={`${account.accountId} はログインできなくなります。`}
				/>
			</div>

			<FormToast result={updateAccountForm.result} />
			<form {...updateAccountForm} class="space-y-4">
				<input type="hidden" name="userId" value={account.id} />
				<div class="grid gap-4 sm:grid-cols-3">
					<label class="grid gap-1">
						<span class="text-sm font-medium text-zinc-700">表示名</span>
						<AppInput name="name" value={account.name} required />
					</label>
					<label class="grid gap-1">
						<span class="text-sm font-medium text-zinc-700">種別</span>
						<AppSelect
							name="accountType"
							value={accountTypeValue(account)}
							items={accountTypeItems}
						/>
					</label>
					<label class="grid gap-1">
						<span class="text-sm font-medium text-zinc-700">チーム</span>
						<AppSelect
							name="teamId"
							value={account.profile?.teamId ?? data.teams[0]?.id ?? ''}
							items={teamItems}
						/>
					</label>
				</div>

				<div class="flex justify-end border-t border-zinc-100 pt-4">
					<AppButton variant="secondary" type="submit">保存</AppButton>
				</div>
			</form>

			<FormToast result={resetPasswordForm.result} />
			<form {...resetPasswordForm} class="mt-4 border-t border-zinc-100 pt-4">
				<input type="hidden" name="userId" value={account.id} />
				<div class="grid gap-3 sm:grid-cols-[1fr_auto]">
					<label class="grid gap-1">
						<span class="text-sm font-medium text-zinc-700">新しいパスワード</span>
						<AppInput name="password" type="password" autocomplete="new-password" required />
					</label>
				<AppButton variant="secondary" type="submit" class="self-end">変更</AppButton>
				</div>
			</form>
		</div>
	{:else}
		<EmptyState message="アカウントはまだありません。" />
	{/each}
</section>
