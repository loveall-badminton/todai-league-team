<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import type { PageProps } from './$types';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import DeleteConfirmDialog from '$lib/components/DeleteConfirmDialog.svelte';
	import { createAccount, updateAccount, resetPassword, deleteAccount } from './accounts.remote';

	let { data }: PageProps = $props();

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

<div class="px-4 py-6 sm:px-6">
	<div class="space-y-6">
		<div class="flex flex-wrap items-end justify-between gap-3">
			<div>
				<a
					href={resolve('/settings')}
					class="text-sm font-medium text-zinc-500 hover:text-zinc-900"
				>
					設定へ戻る
				</a>
				<h1 class="mt-2 text-xl font-semibold text-zinc-950">ユーザー管理</h1>
			</div>
		</div>

		{#if createAccount.result?.message}
			<div class="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
				{createAccount.result.message}
			</div>
		{/if}

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
					<button
						class="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
					>
						発行
					</button>
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
								} catch (e) {
									alert(e instanceof Error ? e.message : 'アカウントの削除に失敗しました');
								}
							}}
							triggerLabel="削除"
							title="アカウントを削除しますか"
							description={`${account.accountId} はログインできなくなります。`}
						/>
					</div>

					{#if updateAccountForm.result?.message}
						<div
							class="mb-3 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700"
						>
							{updateAccountForm.result.message}
						</div>
					{/if}

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
							<button
								class="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
							>
								保存
							</button>
						</div>
					</form>

					{#if resetPasswordForm.result?.message}
						<div
							class="mt-3 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700"
						>
							{resetPasswordForm.result.message}
						</div>
					{/if}

					<form {...resetPasswordForm} class="mt-4 border-t border-zinc-100 pt-4">
						<input type="hidden" name="userId" value={account.id} />
						<div class="grid gap-3 sm:grid-cols-[1fr_auto]">
							<label class="grid gap-1">
								<span class="text-sm font-medium text-zinc-700">新しいパスワード</span>
								<AppInput name="password" type="password" autocomplete="new-password" required />
							</label>
							<button
								class="self-end rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
							>
								変更
							</button>
						</div>
					</form>
				</div>
			{:else}
				<div
					class="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500"
				>
					アカウントはまだありません。
				</div>
			{/each}
		</section>
	</div>
</div>
