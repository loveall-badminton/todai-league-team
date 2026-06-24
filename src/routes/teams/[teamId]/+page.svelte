<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto, invalidateAll } from '$app/navigation';
	import { DragDropProvider } from '@dnd-kit/svelte';
	import AppTabs from '$lib/components/AppTabs.svelte';
	import Card from '$lib/components/Card.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import GroupBadge from '$lib/components/GroupBadge.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import SortablePlayerItem from './SortablePlayerItem.svelte';
	import TeamEditForm from './TeamEditForm.svelte';
	import PlayerCreateForm from './PlayerCreateForm.svelte';
	import PlayerBulkCreateForm from './PlayerBulkCreateForm.svelte';
	import type { PageProps } from './$types';
	import { ArrowLeft } from '@lucide/svelte';
	import { reorderPlayers, deletePlayer, deleteTeam } from './team.remote';
	import { createSortableHandlers } from '$lib/utils/dndEvents';

	const genderItems = [
		{ value: 'unknown', label: '未設定' },
		{ value: 'male', label: '男性' },
		{ value: 'female', label: '女性' }
	];

	let { data }: PageProps = $props();

	let players = $derived([...data.players]);

	let addTab = $state<'single' | 'bulk'>('single');

	const { onDragStart, onDragOver, onDragEnd } = createSortableHandlers(
		() => players,
		(v) => {
			players = v;
		},
		(ids) => reorderPlayers({ ids })
	);
</script>

<svelte:head>
	<title>{data.team.name} | チーム | 東大リーグ団体戦</title>
</svelte:head>

{#snippet headerActions()}
	<div class="flex items-center gap-3">
		<GroupBadge groupCode={data.team.groupCode} />
		{#if data.team.status === 'withdrawn'}
			<span
				class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700"
			>
				棄権
			</span>
		{/if}
	</div>
{/snippet}

<!-- Header -->
<header>
	<a
		href={resolve('/teams')}
		class="mb-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-default"
	>
		<ArrowLeft class="size-3" /> チーム一覧
	</a>
	<PageHeader title={data.team.name} actions={headerActions} />
</header>

<!-- Team edit form -->
<Card>
	{#snippet header()}
		<h2 class="text-base font-semibold text-default">チーム情報</h2>
		<ConfirmDialog
			onConfirm={async () => {
				await deleteTeam();
				await goto(resolve('/teams'));
			}}
			triggerLabel="チームを削除"
			triggerClass="text-xs text-red-500 hover:text-red-700 hover:underline"
			triggerVariant="ghost"
			title="チームを削除しますか？"
			description={`「${data.team.name}」と所属選手のデータをすべて削除します。この操作は取り消せません。`}
			confirmVariant="danger"
			confirmLabel="削除する"
		/>
	{/snippet}
	<TeamEditForm team={data.team} />
</Card>

<!-- Players section -->
<Card class="overflow-hidden" flush>
	{#snippet header()}
		<h2 class="text-base font-semibold text-default">
			選手
			<span class="ml-1.5 text-sm font-normal text-muted">{players.length}名</span>
		</h2>
		{#if players.length > 0}
			<CopyButton text={players.map((p) => p.name).join('\n')} />
		{/if}
	{/snippet}

	<!-- Add player form -->
	<div class="border-b border-border-subtle bg-zinc-50 px-4 py-4">
		<AppTabs
			bind:value={addTab}
			items={[
				{ value: 'single', label: '1人ずつ追加' },
				{ value: 'bulk', label: '一括登録' }
			]}
			listClass="mb-4"
		/>

		{#if addTab === 'single'}
			<PlayerCreateForm {genderItems} />
		{:else if addTab === 'bulk'}
			<PlayerBulkCreateForm />
		{/if}
	</div>

	<!-- Player list -->
	{#if players.length === 0}
		<div class="p-8 text-center">
			<p class="text-sm text-muted">選手はまだ登録されていません</p>
		</div>
	{:else}
		<DragDropProvider {onDragStart} {onDragOver} {onDragEnd}>
			<div class="divide-y divide-zinc-100">
				{#each players as player, index (player.id)}
					<SortablePlayerItem
						{player}
						{index}
						onDeleteConfirm={async () => {
							await deletePlayer({ id: player.id });
							await invalidateAll();
						}}
					/>
				{/each}
			</div>
		</DragDropProvider>
	{/if}
</Card>
