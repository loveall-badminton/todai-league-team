<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { goto, invalidateAll } from '$app/navigation';
	import RealtimeSync from '$lib/components/RealtimeSync.svelte';
	import { DragDropProvider, DragOverlay } from '@dnd-kit/svelte';
	import { createSortableHandlers } from '$lib/utils/dndEvents';
	import { Dialog } from 'bits-ui';
	import { GripVertical, Plus } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import AppTabs from '$lib/components/AppTabs.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import CourtPicker from '$lib/components/CourtPicker.svelte';
	import DialogCloseButton from '$lib/components/DialogCloseButton.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SortableTieItem from '$lib/components/SortableTieItem.svelte';
	import { parseSearchParams, updateUrlSearchParams } from '$lib/utils/searchParams';
	import type { PageProps } from './$types';
	import { create, reorder, updateTie } from './ties.remote';
	import { tieMatchesFilter, VALID_TIE_FILTERS, type TieFilter } from './tieFilter';
	import * as v from 'valibot';

	let { data }: PageProps = $props();

	const tiesSearchParamsSchema = v.object({
		filter: v.optional(v.picklist(VALID_TIE_FILTERS), 'all')
	});

	const groupCodeItems = [
		{ value: '', label: '決勝トーナメント' },
		{ value: 'A', label: 'Aリーグ' },
		{ value: 'B', label: 'Bリーグ' }
	];
	const phaseItems = [
		{ value: 'semifinal', label: '準決勝' },
		{ value: 'fifth_place', label: '5位決定戦' },
		{ value: 'third_place', label: '3位決定戦' },
		{ value: 'final', label: '決勝' },
		{ value: 'ranking_tiebreaker', label: '順位決定再試合' }
	];

	let dialogOpen = $state(false);

	onMount(() => {
		create.fields.set({
			tieCode: '',
			scoringRuleId: data.scoringRules[0]?.id ?? '',
			groupCode: '',
			phase: 'semifinal',
			scheduledStartAt: '',
			teamAId: '',
			teamBId: '',
			roundLabel: '',
			venue: '',
			courtBlockCode: '',
			lineupDueAt: '',
			lineupDuePolicy: ''
		});
	});

	let allTies = $derived([...data.ties]);
	let hasActive = $derived(data.ties.some((t) => t.status === 'playing'));

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
					? data.ties.length
					: data.ties.filter((t) => tieMatchesFilter(t, f.id)).length
		}))
	);

	const { onDragStart, onDragOver, onDragEnd } = createSortableHandlers(
		() => allTies,
		(v) => {
			allTies = v;
		},
		(ids) => reorder({ ids })
	);
</script>

<svelte:head>
	<title>対戦管理 | 東大リーグ団体戦</title>
</svelte:head>

{#snippet headerActions()}
	<div class="flex items-center gap-3">
		{#if hasActive}
			<RealtimeSync
				topics={['score', 'schedule']}
				onUpdate={() => void invalidateAll()}
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
<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl outline-none"
		>
			<div class="mb-5 flex items-center justify-between">
				<Dialog.Title class="text-base font-semibold text-zinc-950">対戦を作成</Dialog.Title>
				<DialogCloseButton />
			</div>

			<form {...create} class="space-y-4">
				<div class="grid gap-3 sm:grid-cols-2">
					<div class="space-y-1">
						<span class="text-xs font-medium text-zinc-600"
							>コード <span class="text-red-500">*</span></span
						>
						<AppInput {...create.fields.tieCode.as('text')} placeholder="A-1" required />
					</div>
					<div class="space-y-1">
						<span class="text-xs font-medium text-zinc-600"
							>得点ルール <span class="text-red-500">*</span></span
						>
						<AppSelect
							{...create.fields.scoringRuleId.as('select')}
							required
							items={data.scoringRules.map((r) => ({ value: r.id, label: r.name ?? r.code }))}
						/>
					</div>
				</div>

				<div class="grid gap-3 sm:grid-cols-3">
					<div class="space-y-1">
						<span class="text-xs font-medium text-zinc-600">リーグ</span>
						<AppSelect
							{...create.fields.groupCode.as('select')}
							items={groupCodeItems}
							placeholder="決勝トーナメント"
						/>
					</div>
					<div class="space-y-1">
						<span class="text-xs font-medium text-zinc-600">フェーズ</span>
						<AppSelect {...create.fields.phase.as('select')} items={phaseItems} />
					</div>
					<div class="space-y-1">
						<span class="text-xs font-medium text-zinc-600">予定時刻</span>
						<AppInput {...create.fields.scheduledStartAt.as('time')} />
					</div>
				</div>

				<div class="grid gap-3 sm:grid-cols-2">
					<div class="space-y-1">
						<span class="text-xs font-medium text-zinc-600">A側チーム</span>
						<AppSelect
							{...create.fields.teamAId.as('select')}
							items={[
								{ value: '', label: '未定' },
								...data.teams.map((t) => ({ value: t.id, label: t.name }))
							]}
							placeholder="未定"
						/>
					</div>
					<div class="space-y-1">
						<span class="text-xs font-medium text-zinc-600">B側チーム</span>
						<AppSelect
							{...create.fields.teamBId.as('select')}
							items={[
								{ value: '', label: '未定' },
								...data.teams.map((t) => ({ value: t.id, label: t.name }))
							]}
							placeholder="未定"
						/>
					</div>
				</div>

				<div class="space-y-1">
					<span class="text-xs font-medium text-zinc-600">体育館・コート</span>
					<CourtPicker />
				</div>

				<div class="flex justify-end gap-2 pt-1">
					<Dialog.Close
						class="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
					>
						キャンセル
					</Dialog.Close>
					<AppButton type="submit">作成</AppButton>
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

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
				<SortableTieItem
					{tie}
					{index}
					sortable={filter === 'all'}
					teams={data.teams}
					tieForm={updateTie.for(tie.id)}
				/>
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
