<script lang="ts">
	import { page } from '$app/state';
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
	import { shouldRefreshGroupPage } from '$lib/realtime/updates';
	import type { GroupStanding } from '$lib/server/services/standingService';
	import type { TieSummary } from '$lib/server/repositories/tokyoLeagueRepository';
	import { toast } from 'svelte-sonner';
	import {
		generateRoundRobin,
		getGroupPageData,
		getGroupRealtimeData,
		reorder
	} from './group.remote';
	import GroupTeamsCard from './GroupTeamsCard.svelte';
	import GroupTiebreakerSection from './GroupTiebreakerSection.svelte';
	import ManualRankForm from './ManualRankForm.svelte';

	const groupCode = page.params.groupCode!;
	const groupStaticQuery = getGroupPageData(groupCode);
	const groupPageQuery = getGroupRealtimeData(groupCode);
	const [initialGroupStatic, initialGroupPage] = await Promise.all([
		groupStaticQuery,
		groupPageQuery
	]);
	let groupStatic = $derived(groupStaticQuery.current ?? initialGroupStatic);
	let groupPage = $derived(groupPageQuery.current ?? initialGroupPage);

	// dnd-kit のドラッグ中に onDragOver がこの配列を直接書き換えて見た目の並び替えを行うため、
	// $derived のオーバーライドではなく独立した $state として保持し、サーバーデータが
	// 変わったときだけ $effect で同期する。
	// eslint-disable-next-line svelte/prefer-writable-derived
	let allTies: TieSummary[] = $state(initialGroupPage.ties);
	$effect(() => {
		allTies = groupPage.ties;
	});

	const { onDragStart, onDragOver, onDragEnd } = createSortableHandlers(
		() => allTies,
		(v) => {
			allTies = v;
		},
		async (ids) => {
			try {
				await reorder({ ids });
			} catch (e) {
				toast.error(e instanceof Error ? e.message : '並び替えに失敗しました');
			} finally {
				await groupPageQuery.refresh();
			}
		}
	);

	const teamName = (teamId: string | null) =>
		groupStatic.allTeams.find((t) => t.id === teamId)?.name ?? '不明';

	let groupTeamItems = $derived([
		{ value: '', label: '選択' },
		...groupStatic.groupTeams.map((t) => ({ value: t.id, label: t.name }))
	]);

	// Round-robin matrix helpers
	let orderedTeams = $derived(
		groupPage.standings.length > 0
			? groupPage.standings
					.map((r: GroupStanding) => groupStatic.groupTeams.find((t) => t.id === r.teamId))
					.filter((t): t is (typeof groupStatic.groupTeams)[number] => t != null)
			: groupStatic.groupTeams
	);

	async function run(fn: () => Promise<unknown>) {
		try {
			const result = await fn();
			await groupPageQuery.refresh();
			if (result && typeof result === 'object' && 'message' in result) {
				toast.success(String((result as { message: string }).message));
			}
		} catch (e) {
			toast.error(e instanceof Error ? e.message : '失敗');
		}
	}
</script>

<svelte:head>
	<title>{groupStatic.groupCode}リーグ | 東大リーグ団体戦</title>
</svelte:head>

{#snippet headerActions()}
	<div class="flex items-center gap-3">
		<RealtimeSync
			topics={['standings', 'schedule']}
			refresh={() => groupPageQuery.refresh()}
			shouldRefresh={(update) =>
				shouldRefreshGroupPage(
					update,
					groupStatic.groupCode,
					groupPage.ties.map((tie: TieSummary) => tie.id)
				)}
		/>
		<AppButton onclick={() => run(() => generateRoundRobin())}>総当たり生成</AppButton>
	</div>
{/snippet}

<PageHeader eyebrow="予選リーグ" title={`${groupStatic.groupCode}リーグ`} actions={headerActions} />

<GroupTeamsCard teams={groupStatic.groupTeams} />

<!-- Standings + round-robin matrix (merged) -->
{#snippet standingsExtraHead()}
	<th class="w-20 px-4 py-2 text-left text-xs font-medium text-muted">状態</th>
	<th class="min-w-48 px-4 py-2 text-left text-xs font-medium text-muted">手動順位</th>
{/snippet}

{#snippet standingsExtraCell(row: (typeof groupPage.standings)[number])}
	<td class="px-4 py-2.5">
		{#if row.requiresTiebreaker}
			<Badge color="amber">再試合必要</Badge>
		{:else if row.manualRank}
			<Badge>手動</Badge>
		{:else}
			<span class="text-xs text-muted-foreground">{row.headToHeadSummary ?? '自動判定'}</span>
		{/if}
	</td>
	<td class="px-4 py-2.5">
		<ManualRankForm teamId={row.teamId} manualRank={row.manualRank ?? row.rank ?? 0} />
	</td>
{/snippet}

<Card class="min-w-0" flush>
	{#snippet header()}
		<h2 class="font-semibold">順位表</h2>
	{/snippet}

	<GroupStandingsTable
		standings={groupPage.standings}
		ties={groupPage.ties}
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
					<SortableTieItem {tie} {index} teams={groupStatic.allTeams} />
				{/each}
			</div>
			<DragOverlay dropAnimation={null}>
				{#snippet children(draggable)}
					{@const tie = allTies.find((t) => t.id === String(draggable.id))}
					{#if tie}
						<div
							class="overflow-hidden rounded-xl border border-border bg-white opacity-95 shadow-xl"
						>
							<div class="flex items-stretch">
								<div
									class="flex shrink-0 cursor-grabbing items-center border-r border-border-subtle px-3 text-muted"
								>
									<GripVertical class="h-4 w-4" />
								</div>
								<div class="flex flex-1 items-center px-4 py-3">
									<div class="flex min-w-0 flex-col gap-0.5">
										<span class="font-semibold text-default">{tie.tieCode}</span>
										<p class="truncate text-sm text-muted-emphasis">
											{tie.teamAName ?? '未定'} <span class="text-muted">vs</span>
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
	rankingTiebreakers={groupPage.rankingTiebreakers}
	{groupTeamItems}
	groupTeamPlayers={groupStatic.groupTeamPlayers}
	{teamName}
/>
