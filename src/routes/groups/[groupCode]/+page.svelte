<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import RealtimeSync from '$lib/components/RealtimeSync.svelte';
	import { DragDropProvider, DragOverlay } from '@dnd-kit/svelte';
	import { createSortableHandlers } from '$lib/utils/dndEvents';
	import Card from '$lib/components/Card.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import GroupStandingsTable from '$lib/components/GroupStandingsTable.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import AppButton from '$lib/components/AppButton.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { GripVertical } from '@lucide/svelte';
	import SortableTieItem from '$lib/components/SortableTieItem.svelte';
	import type { PageProps } from './$types';
	import { toast } from 'svelte-sonner';
	import {
		generateRoundRobin,
		setManualRank,
		createTiebreaker,
		syncTiebreaker,
		reorder,
		updateTie
	} from './group.remote';
	import GroupTeamsCard from './GroupTeamsCard.svelte';
	import GroupTiebreakerSection from './GroupTiebreakerSection.svelte';
	import ManualRankForm from './ManualRankForm.svelte';

	let { data }: PageProps = $props();

	let allTies = $derived([...data.ties]);

	const { onDragStart, onDragOver, onDragEnd } = createSortableHandlers(
		() => allTies,
		(v) => {
			allTies = v;
		},
		(ids) => reorder({ ids })
	);

	const teamName = (teamId: string | null) =>
		data.allTeams.find((t) => t.id === teamId)?.name ?? '不明';

	let groupTeamItems = $derived([
		{ value: '', label: '選択' },
		...data.groupTeams.map((t) => ({ value: t.id, label: t.name }))
	]);

	// Round-robin matrix helpers
	let orderedTeams = $derived(
		data.standings.length > 0
			? data.standings
					.map((r) => data.groupTeams.find((t) => t.id === r.teamId))
					.filter((t) => t != null)
			: data.groupTeams
	);

	async function run(fn: () => Promise<unknown>) {
		try {
			const result = await fn();
			await invalidateAll();
			if (result && typeof result === 'object' && 'message' in result) {
				toast.success(String((result as { message: string }).message));
			}
		} catch (e) {
			toast.error(e instanceof Error ? e.message : '失敗');
		}
	}
</script>

<svelte:head>
	<title>{data.groupCode}リーグ | 東大リーグ団体戦</title>
</svelte:head>

{#snippet headerActions()}
	<div class="flex items-center gap-3">
		<RealtimeSync topics={['standings', 'schedule']} onUpdate={() => void invalidateAll()} />
		<AppButton onclick={() => run(() => generateRoundRobin())}>総当たり生成</AppButton>
	</div>
{/snippet}

<PageHeader eyebrow="予選リーグ" title={`${data.groupCode}リーグ`} actions={headerActions} />

<GroupTeamsCard teams={data.groupTeams} />

<!-- Standings + round-robin matrix (merged) -->
{#snippet standingsExtraHead()}
	<th class="w-20 px-4 py-2 text-left text-xs font-medium text-zinc-400">状態</th>
	<th class="min-w-48 px-4 py-2 text-left text-xs font-medium text-zinc-400">手動順位</th>
{/snippet}

{#snippet standingsExtraCell(row: (typeof data.standings)[number])}
	{@const rankForm = setManualRank.for(row.teamId)}
	<td class="px-4 py-2.5">
		{#if row.requiresTiebreaker}
			<Badge color="amber">再試合必要</Badge>
		{:else if row.manualRank}
			<Badge>手動</Badge>
		{:else}
			<span class="text-xs text-zinc-500">{row.headToHeadSummary ?? '自動判定'}</span>
		{/if}
	</td>
	<td class="px-4 py-2.5">
		<ManualRankForm
			form={rankForm}
			teamId={row.teamId}
			manualRank={row.manualRank ?? row.rank ?? 0}
		/>
	</td>
{/snippet}

<Card class="min-w-0" flush>
	{#snippet header()}
		<h2 class="font-semibold">順位表</h2>
	{/snippet}

	<GroupStandingsTable
		standings={data.standings}
		ties={data.ties}
		teams={orderedTeams}
		linkTies={true}
		extraHead={standingsExtraHead}
		extraCell={standingsExtraCell}
	/>
</Card>

<!-- Ties -->
<section class="space-y-3">
	<h2 class="font-semibold">総当たり対戦</h2>

	{#if allTies.length === 0}
		<EmptyState message="チームが2つ以上ある場合、総当たり対戦を生成できます。" />
	{:else}
		<DragDropProvider {onDragStart} {onDragOver} {onDragEnd}>
			<div class="space-y-2">
				{#each allTies as tie, index (tie.id)}
					<SortableTieItem {tie} {index} teams={data.allTeams} tieForm={updateTie.for(tie.id)} />
				{/each}
			</div>
			<DragOverlay dropAnimation={null}>
				{#snippet children(draggable)}
					{@const tie = allTies.find((t) => t.id === String(draggable.id))}
					{#if tie}
						<div
							class="overflow-hidden rounded-xl border border-zinc-200 bg-white opacity-95 shadow-xl"
						>
							<div class="flex items-stretch">
								<div
									class="flex shrink-0 cursor-grabbing items-center border-r border-zinc-100 px-3 text-zinc-400"
								>
									<GripVertical class="h-4 w-4" />
								</div>
								<div class="flex flex-1 items-center px-4 py-3">
									<div class="flex min-w-0 flex-col gap-0.5">
										<span class="font-semibold text-zinc-950">{tie.tieCode}</span>
										<p class="truncate text-sm text-zinc-600">
											{tie.teamAName ?? '未定'} <span class="text-zinc-400">vs</span>
											{tie.teamBName ?? '未定'}
										</p>
									</div>
								</div>
							</div>
						</div>
					{/if}
				{/snippet}
			</DragOverlay>
		</DragDropProvider>
	{/if}
</section>

<GroupTiebreakerSection
	createTiebreakerForm={createTiebreaker}
	rankingTiebreakers={data.rankingTiebreakers}
	{groupTeamItems}
	groupTeamPlayers={data.groupTeamPlayers}
	onSyncTiebreaker={(matchId) => run(() => syncTiebreaker({ matchId }))}
	{teamName}
/>
