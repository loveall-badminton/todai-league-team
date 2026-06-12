<script lang="ts">
	import { page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import { DragDropProvider } from '@dnd-kit/svelte';
	import { isSortable } from '@dnd-kit/svelte/sortable';
	import { untrack } from 'svelte';
	import type { ComponentProps } from 'svelte';
	type DragOverEvent = Parameters<NonNullable<ComponentProps<typeof DragDropProvider>['onDragOver']>>[0];
	type DragEndEvent = Parameters<NonNullable<ComponentProps<typeof DragDropProvider>['onDragEnd']>>[0];
	import { Dialog, Tabs } from 'bits-ui';
	import { X } from '@lucide/svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FormMessage from '$lib/components/FormMessage.svelte';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import CourtPicker from '$lib/components/CourtPicker.svelte';
	import SortableTieItem from './SortableTieItem.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const groupCodeItems = [
		{ value: '', label: '決勝系' },
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
	let newScoringRuleId = $state('');
	let dialogOpen = $state(false);

	let allTies = $state(untrack(() => [...data.ties]));
	let snapshot: typeof allTies = [];

	$effect(() => { allTies = [...data.ties]; });

	// Auto-refresh while any tie is playing
	$effect(() => {
		const hasActive = data.ties.some((t) => t.status === 'playing');
		if (!hasActive) return;
		const interval = setInterval(() => invalidateAll(), 12000);
		return () => clearInterval(interval);
	});

	$effect(() => {
		if (newScoringRuleId === '' && data.scoringRules.length > 0) {
			newScoringRuleId = data.scoringRules[0].id;
		}
	});

	// Close dialog on successful create (form message present and no errors)
	$effect(() => {
		if (form?.message && !form.message.includes('失敗') && !form.message.includes('エラー')) {
			dialogOpen = false;
		}
	});

	type Filter =
		| 'all' | 'group_a' | 'group_b' | 'semifinal' | 'final'
		| 'third_place' | 'fifth_place' | 'lineup_pending' | 'playing'
		| 'finished' | 'schedule_changed';

	const VALID_FILTERS: Filter[] = [
		'all', 'group_a', 'group_b', 'semifinal', 'final', 'third_place', 'fifth_place',
		'lineup_pending', 'playing', 'finished', 'schedule_changed'
	];

	const filter = $derived.by<Filter>(() => {
		const v = page.url.searchParams.get('filter');
		return VALID_FILTERS.includes(v as Filter) ? (v as Filter) : 'all';
	});

	function setFilter(value: string) {
		const url = new URL(page.url);
		if (value === 'all') url.searchParams.delete('filter');
		else url.searchParams.set('filter', value);
		goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
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

	const filteredTies = $derived(allTies.filter((t) => tieMatchesFilter(t, filter)));

	function onDragStart() { snapshot = allTies.slice(); }

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
		if (event.canceled) { allTies = snapshot; return; }
		const fd = new FormData();
		fd.set('ids', JSON.stringify(allTies.map((t) => t.id)));
		await fetch('?/reorder', {
			method: 'POST',
			headers: { accept: 'application/json', 'x-sveltekit-action': 'true' },
			body: fd
		});
	}
</script>

<svelte:head>
	<title>対戦管理 | 東大リーグ団体戦</title>
</svelte:head>

<div class="px-4 py-6 sm:px-6">
	<div class="mx-auto max-w-5xl space-y-5">

		<!-- Header -->
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h1 class="text-xl font-semibold text-zinc-950">対戦管理</h1>
			<Dialog.Root bind:open={dialogOpen}>
				<Dialog.Trigger>
					{#snippet child({ props })}
						<AppButton {...props}>+ 新規作成</AppButton>
					{/snippet}
				</Dialog.Trigger>
				<Dialog.Portal>
					<Dialog.Overlay class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
					<Dialog.Content
						class="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl outline-none max-h-[90vh] overflow-y-auto"
					>
						<div class="flex items-center justify-between mb-5">
							<Dialog.Title class="text-base font-semibold text-zinc-950">対戦を作成</Dialog.Title>
							<Dialog.Close class="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
								<X class="size-4" />
							</Dialog.Close>
						</div>

						<form method="POST" action="?/create" class="space-y-4">
							<div class="grid gap-3 sm:grid-cols-2">
								<div class="space-y-1">
									<span class="text-xs font-medium text-zinc-600">コード <span class="text-red-500">*</span></span>
									<AppInput name="tieCode" placeholder="A-1" required />
								</div>
								<div class="space-y-1">
									<span class="text-xs font-medium text-zinc-600">得点ルール <span class="text-red-500">*</span></span>
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
									<AppSelect name="groupCode" bind:value={newGroupCode} items={groupCodeItems} placeholder="決勝系" />
								</div>
								<div class="space-y-1">
									<span class="text-xs font-medium text-zinc-600">フェーズ</span>
									<AppSelect name="phase" bind:value={newPhase} items={phaseItems} />
								</div>
								<div class="space-y-1">
									<span class="text-xs font-medium text-zinc-600">予定時刻</span>
									<AppInput name="scheduledStartAt" type="datetime-local" />
								</div>
							</div>

							<div class="grid gap-3 sm:grid-cols-2">
								<div class="space-y-1">
									<span class="text-xs font-medium text-zinc-600">A側チーム</span>
									<AppSelect
										name="teamAId"
										bind:value={newTeamAId}
										items={[{ value: '', label: '未定' }, ...data.teams.map((t) => ({ value: t.id, label: t.name }))]}
										placeholder="未定"
									/>
								</div>
								<div class="space-y-1">
									<span class="text-xs font-medium text-zinc-600">B側チーム</span>
									<AppSelect
										name="teamBId"
										bind:value={newTeamBId}
										items={[{ value: '', label: '未定' }, ...data.teams.map((t) => ({ value: t.id, label: t.name }))]}
										placeholder="未定"
									/>
								</div>
							</div>

							<div class="space-y-1">
								<span class="text-xs font-medium text-zinc-600">体育館・コート</span>
								<CourtPicker />
							</div>

							<div class="flex justify-end gap-2 pt-1">
								<Dialog.Close class="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
									キャンセル
								</Dialog.Close>
								<AppButton type="submit">作成</AppButton>
							</div>
						</form>
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog.Root>
		</div>

		<FormMessage message={form?.message} />

		<!-- Filter tabs (horizontally scrollable) -->
		<Tabs.Root value={filter} onValueChange={setFilter}>
			<Tabs.List class="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
				{#each filters as f (f.id)}
					{@const count = f.id === 'all'
						? data.ties.length
						: data.ties.filter((t) => tieMatchesFilter(t, f.id)).length}
					<Tabs.Trigger
						value={f.id}
						class="shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors {filter === f.id
							? 'bg-zinc-900 text-white'
							: 'border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400'}"
					>
						{f.label}
						{#if count > 0}
							<span class="ml-1 {filter === f.id ? 'text-zinc-300' : 'text-zinc-400'}">{count}</span>
						{/if}
					</Tabs.Trigger>
				{/each}
			</Tabs.List>
		</Tabs.Root>

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
						<SortableTieItem {tie} {index} sortable={filter === 'all'} teams={data.teams} />
					{/each}
				</div>
			</DragDropProvider>
		{/if}
	</div>
</div>
