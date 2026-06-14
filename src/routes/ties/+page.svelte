<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { goto, invalidateAll } from '$app/navigation';
	import { DragDropProvider, DragOverlay } from '@dnd-kit/svelte';
	import { isSortable } from '@dnd-kit/svelte/sortable';
	import type { ComponentProps } from 'svelte';
	type DragOverEvent = Parameters<
		NonNullable<ComponentProps<typeof DragDropProvider>['onDragOver']>
	>[0];
	type DragEndEvent = Parameters<
		NonNullable<ComponentProps<typeof DragDropProvider>['onDragEnd']>
	>[0];
	import { Dialog } from 'bits-ui';
	import { GripVertical, X } from '@lucide/svelte';
	import AppSwitch from '$lib/components/AppSwitch.svelte';
	import AppTabs from '$lib/components/AppTabs.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import CourtPicker from '$lib/components/CourtPicker.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SortableTieItem from '$lib/components/SortableTieItem.svelte';
	import type { PageProps } from './$types';
	import { create, reorder, updateTie } from './ties.remote';

	let { data }: PageProps = $props();

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

	let newGroupCode = $state('');
	let newPhase = $state('semifinal');
	let newTeamAId = $state('');
	let newTeamBId = $state('');
	let newScoringRuleId = $derived(data.scoringRules[0]?.id ?? '');
	let dialogOpen = $state(false);

	let allTies = $derived([...data.ties]);
	let snapshot: typeof allTies = [];

	let hasActive = $derived(data.ties.some((t) => t.status === 'playing'));
	let realtimeEnabled = $state(true);

	$effect(() => {
		if (!hasActive || !realtimeEnabled) return;
		const id = setInterval(() => invalidateAll(), 12000);
		return () => clearInterval(id);
	});

	type Filter =
		| 'all'
		| 'group_a'
		| 'group_b'
		| 'semifinal'
		| 'final'
		| 'third_place'
		| 'fifth_place'
		| 'lineup_pending'
		| 'playing'
		| 'finished'
		| 'schedule_changed';

	const VALID_FILTERS: Filter[] = [
		'all',
		'group_a',
		'group_b',
		'semifinal',
		'final',
		'third_place',
		'fifth_place',
		'lineup_pending',
		'playing',
		'finished',
		'schedule_changed'
	];

	let filter = $derived.by<Filter>(() => {
		const v = page.url.searchParams.get('filter');
		return VALID_FILTERS.includes(v as Filter) ? (v as Filter) : 'all';
	});

	function setFilter(value: string) {
		const url = new URL(page.url);
		if (value === 'all') url.searchParams.delete('filter');
		else url.searchParams.set('filter', value);
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(resolve('/ties') + url.search, { replaceState: true, noScroll: true, keepFocus: true });
	}

	const filters: { id: Filter; label: string }[] = [
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

	function tieMatchesFilter(tie: (typeof allTies)[0], f: Filter) {
		if (f === 'all') return true;
		if (f === 'group_a') return tie.phase === 'group_a';
		if (f === 'group_b') return tie.phase === 'group_b';
		if (f === 'semifinal') return tie.phase === 'semifinal';
		if (f === 'final') return tie.phase === 'final';
		if (f === 'third_place') return tie.phase === 'third_place';
		if (f === 'fifth_place') return tie.phase === 'fifth_place';
		if (f === 'lineup_pending') return tie.status === 'lineup_pending';
		if (f === 'playing') return tie.status === 'playing';
		if (f === 'finished') return tie.status === 'finished';
		if (f === 'schedule_changed') return tie.scheduleChanged;
		return true;
	}

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

	function onDragStart() {
		snapshot = allTies.slice();
	}

	function onDragOver(event: DragOverEvent) {
		const { source, target } = event.operation;
		if (isSortable(source) && isSortable(target) && source.index !== target.index) {
			const next = [...allTies];
			const [moved] = next.splice(source.index, 1);
			next.splice(target.index, 0, moved);
			allTies = next;
		}
	}

	async function onDragEnd(event: DragEndEvent) {
		if (event.canceled) {
			allTies = snapshot;
			return;
		}
		await reorder({ ids: allTies.map((t) => t.id) });
	}
</script>

<svelte:head>
	<title>対戦管理 | 東大リーグ団体戦</title>
</svelte:head>

{#snippet headerActions()}
	<div class="flex items-center gap-3">
		{#if hasActive}
			<AppSwitch bind:checked={realtimeEnabled} label="自動更新" />
		{/if}
		<AppButton type="button" onclick={() => (dialogOpen = true)}>+ 新規作成</AppButton>
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
				<Dialog.Close class="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
					<X class="size-4" />
				</Dialog.Close>
			</div>

			<form {...create} class="space-y-4">
				<div class="grid gap-3 sm:grid-cols-2">
					<div class="space-y-1">
						<span class="text-xs font-medium text-zinc-600"
							>コード <span class="text-red-500">*</span></span
						>
						<AppInput name="tieCode" placeholder="A-1" required />
					</div>
					<div class="space-y-1">
						<span class="text-xs font-medium text-zinc-600"
							>得点ルール <span class="text-red-500">*</span></span
						>
						<AppSelect
							name="scoringRuleId"
							bind:value={newScoringRuleId}
							required
							items={data.scoringRules.map((r) => ({ value: r.id, label: r.name ?? r.code }))}
						/>
					</div>
				</div>

				<div class="grid gap-3 sm:grid-cols-3">
					<div class="space-y-1">
						<span class="text-xs font-medium text-zinc-600">リーグ</span>
						<AppSelect
							name="groupCode"
							bind:value={newGroupCode}
							items={groupCodeItems}
							placeholder="決勝トーナメント"
						/>
					</div>
					<div class="space-y-1">
						<span class="text-xs font-medium text-zinc-600">フェーズ</span>
						<AppSelect name="phase" bind:value={newPhase} items={phaseItems} />
					</div>
					<div class="space-y-1">
						<span class="text-xs font-medium text-zinc-600">予定時刻</span>
						<AppInput name="scheduledStartAt" type="time" />
					</div>
				</div>

				<div class="grid gap-3 sm:grid-cols-2">
					<div class="space-y-1">
						<span class="text-xs font-medium text-zinc-600">A側チーム</span>
						<AppSelect
							name="teamAId"
							bind:value={newTeamAId}
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
							name="teamBId"
							bind:value={newTeamBId}
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
					<div class="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl opacity-95">
						<div class="flex items-stretch">
							<div
								class="flex shrink-0 cursor-grabbing items-center border-r border-zinc-100 px-3 text-zinc-400"
							>
								<GripVertical class="h-4 w-4" />
							</div>
							<div class="flex flex-1 items-center px-4 py-3">
								<div class="flex min-w-0 flex-col gap-0.5">
									<span class="font-semibold text-zinc-900">{tie.tieCode}</span>
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
