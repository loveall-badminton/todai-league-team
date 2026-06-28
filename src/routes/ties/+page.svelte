<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import RealtimeSync from '$lib/components/RealtimeSync.svelte';
	import { DragDropProvider, DragOverlay } from '@dnd-kit/svelte';
	import { createSortableHandlers } from '$lib/utils/dndEvents';
	import { GripVertical, Plus } from '@lucide/svelte';
	import AppTabs from '$lib/components/AppTabs.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import AppButton from '$lib/components/AppButton.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SortableTieItem from '$lib/components/SortableTieItem.svelte';
	import { createRealtimeQueryFlow } from '$lib/realtime/queryFlow';
	import { shouldRefreshTiesPage, type RealtimeUpdate } from '$lib/realtime/updates';
	import { parseSearchParams, updateUrlSearchParams } from '$lib/utils/searchParams';
	import { getTiesData, getTiesPageData, reorder } from './ties.remote';
	import { tieMatchesFilter, VALID_TIE_FILTERS, type TieFilter } from './tieFilter';
	import * as v from 'valibot';
	import TieCreateDialog from './TieCreateDialog.svelte';

	const tiesQuery = getTiesData();
	const tiesPageQuery = getTiesPageData();
	const [initialTiesPage, initialTiesData] = await Promise.all([tiesPageQuery, tiesQuery]);
	let tiesPage = $derived(tiesPageQuery.current ?? initialTiesPage);
	let tiesData = $derived(tiesQuery.current ?? initialTiesData);

	const tiesSearchParamsSchema = v.object({
		filter: v.optional(v.picklist(VALID_TIE_FILTERS), 'all')
	});

	let dialogOpen = $state(false);

	let allTies = $derived(tiesData.ties);
	let hasActive = $derived(tiesData.ties.some((t) => t.status === 'playing'));

	let filter = $derived.by<TieFilter>(() => {
		return parseSearchParams(page.url.searchParams, tiesSearchParamsSchema, { filter: 'all' })
			.filter;
	});

	function setFilter(value: string) {
		const url = updateUrlSearchParams(
			page.url,
			tiesSearchParamsSchema,
			{ filter: value },
			{ omit: (key, searchValue) => key === 'filter' && searchValue === 'all' }
		);
		if (!url) return;

		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(resolve('/ties') + url.search, { replaceState: true, noScroll: true, keepFocus: true });
	}

	const filters: { id: TieFilter; label: string }[] = [
		{ id: 'all', label: 'すべて' },
		{ id: 'group_a', label: 'Aリーグ' },
		{ id: 'group_b', label: 'Bリーグ' },
		{ id: 'semifinal', label: '準決勝' },
		{ id: 'final', label: '決勝' },
		{ id: 'third_place', label: '3位決定戦' },
		{ id: 'fifth_place', label: '5位決定戦' },
		{ id: 'lineup_pending', label: 'オーダー未提出' },
		{ id: 'playing', label: '進行中' },
		{ id: 'finished', label: '結果確認待ち' },
		{ id: 'schedule_changed', label: 'スケジュール変更' }
	];

	let filteredTies = $derived(allTies.filter((t) => tieMatchesFilter(t, filter)));

	let tabItems = $derived(
		filters.map((f) => ({
			value: f.id,
			label: f.label,
			count:
				f.id === 'all'
					? tiesData.ties.length
					: tiesData.ties.filter((t) => tieMatchesFilter(t, f.id)).length
		}))
	);

	const { onDragStart, onDragOver, onDragEnd } = createSortableHandlers(
		() => allTies,
		(v) => {
			allTies = v;
		},
		(ids) => reorder({ ids })
	);

	const handleRealtimeUpdate = createRealtimeQueryFlow({
		refresh: () => tiesQuery.refresh(),
		shouldRefresh: (update: RealtimeUpdate) => shouldRefreshTiesPage(update)
	});
</script>

<svelte:head>
	<title>対戦管理 | 東大リーグ団体戦</title>
</svelte:head>

{#snippet headerActions()}
	<div class="flex items-center gap-3">
		{#if hasActive}
			<RealtimeSync
				topics={['score', 'schedule']}
				onUpdate={(u) => void handleRealtimeUpdate(u)}
				pollInterval={12000}
			/>
		{/if}
		<AppButton type="button" onclick={() => (dialogOpen = true)}>
			<Plus class="size-4" />
			新規作成
		</AppButton>
	</div>
{/snippet}

<PageHeader title="対戦管理" actions={headerActions} />

{#if dialogOpen}
	<TieCreateDialog bind:open={dialogOpen} data={tiesPage} />
{/if}

<AppTabs value={filter} items={tabItems} onValueChange={setFilter} />

<!-- Ties list -->
{#if filteredTies.length === 0}
	<EmptyState
		message={filter === 'all'
			? '対戦はまだありません。予選リーグで総当たり生成するか、「新規作成」から追加します。'
			: 'このフィルターに該当する対戦はありません。'}
	/>
{:else}
	<DragDropProvider {onDragStart} {onDragOver} {onDragEnd}>
		<div class="space-y-1.5">
			{#each filteredTies as tie, index (tie.id)}
				<SortableTieItem {tie} {index} sortable={filter === 'all'} teams={tiesPage.teams} />
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
