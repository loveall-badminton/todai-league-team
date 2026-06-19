<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AppButton from '$lib/components/AppButton.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Card from '$lib/components/Card.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { Pencil, ShieldCheck, UserRound, UsersRound } from '@lucide/svelte';
	import type { SelectItem } from '$lib/types/ui';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { PageProps } from './$types';
	import { createAccount, deleteAccount, resetPassword, updateAccount } from './accounts.remote';
	import AccountCreateForm from './AccountCreateForm.svelte';
	import AccountEditDialog from './AccountEditDialog.svelte';

	let { data }: PageProps = $props();

	const accountTypeItems: SelectItem[] = [
		{ value: 'participant', label: '一般参加者' },
		{ value: 'team', label: 'チーム' },
		{ value: 'admin', label: '運営' }
	];
	let teamItems = $derived(
		data.teams.map((team): SelectItem => ({ value: team.id, label: team.name }))
	);

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
	<AccountCreateForm form={createAccount} {accountTypeItems} {teamItems} />
</Card>

<section class="space-y-4">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 class="font-semibold text-zinc-950">発行済みアカウント</h2>
			<p class="mt-1 text-sm text-zinc-500">ログインID、権限、チーム紐づけを一覧で確認できます。</p>
		</div>
	</div>

	{#if data.accounts.length}
		<Card class="overflow-hidden" flush>
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

<AccountEditDialog
	bind:open={editOpen}
	{editAccount}
	{updateAccount}
	{resetPassword}
	{accountTypeItems}
	{accountTypeValue}
	{accountTypeBadgeColor}
	{accountTypeLabel}
	{accountTypeIcon}
	{teamItems}
/>
