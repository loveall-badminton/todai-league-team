<script lang="ts">
	import { page } from '$app/state';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import RealtimeSync from '$lib/components/RealtimeSync.svelte';
	import LiveTieDetail from './LiveTieDetail.svelte';
	import { hasScoreUpdate } from '$lib/realtime/channels';
	import { buildRubberScorePatch } from '$lib/realtime/scorePatch';
	import { isConfirmableMatchStatus } from '$lib/domain/matchStatus';
	import { PatchCollection } from '$lib/optimistic';
	import type { RealtimeUpdate } from '$lib/realtime/updates';
	import { getTieDetail, getTieProgression } from './tie-detail.remote';
	import {
		applyRealtimeProgressionEvent,
		type ProgressionRealtimeState
	} from '../../progressionRealtime';

	// tieId is always present for this route
	const tieId = page.params.tieId!;

	const tieDetailQuery = getTieDetail(tieId);
	let tieDetailData = $derived(await tieDetailQuery);

	const scorePatches = new PatchCollection({
		getServerItems: () => tieDetailData?.rubbers ?? [],
		getId: (r) => r.matchId ?? r.id,
		reconcileDelayMs: 11000,
		onReconcile: () => {
			void refreshTieDetail();
			if (expandedRubberId !== null) void loadProgression();
		}
	});
	let rubbers = $derived(scorePatches.items);

	let progression: { current: ProgressionRealtimeState | null } = $state({ current: null });
	let expandedRubberId: string | null = $state(null);

	async function loadProgression() {
		try {
			const data = await getTieProgression(tieId);
			progression = { current: data };
		} catch {
			// non-critical — chart just shows skeleton/no-data
		}
	}

	function handleExpand() {
		void loadProgression();
	}

	function applyProgressionEvent(
		matchId: string,
		scoreEvent?: import('$lib/realtime/channels').LiveScoreEvent
	): 'applied' | 'refresh' | 'ignore' {
		const prog = progression.current;
		if (!prog) return 'ignore';
		const next = applyRealtimeProgressionEvent(matchId, scoreEvent, prog);
		if (next === null) return 'ignore';
		if (next === 'refresh') return 'refresh';
		progression = { current: next };
		return 'applied';
	}

	async function refreshTieDetail() {
		const snapshot = scorePatches.snapshot();
		await tieDetailQuery.refresh();
		scorePatches.invalidateStale(snapshot);
	}

	$effect(() => {
		return () => scorePatches.destroy();
	});

	function refreshAll() {
		void refreshTieDetail();
		if (expandedRubberId !== null) void loadProgression();
	}

	function applyUpdate(update: RealtimeUpdate): 'applied' | 'refresh' | 'ignore' {
		if (update.source === 'poll') return 'refresh';
		if (!update.data || !hasScoreUpdate(update.data)) {
			if (update.topics.includes('schedule') && update.data?.schedule?.tieIds?.includes(tieId)) {
				return 'refresh';
			}
			return 'ignore';
		}
		const state = update.data.score.state;
		const rubber = rubbers.find((r) => r.matchId === state.matchId);
		if (!rubber) return 'ignore';
		const currentSeqNo = scorePatches.get(state.matchId)?.lastSeqNo ?? rubber.lastSeqNo ?? 0;
		if (state.lastSeqNo < currentSeqNo) {
			return 'ignore';
		}
		scorePatches.apply(state.matchId, buildRubberScorePatch(state));
		const progResult = applyProgressionEvent(state.matchId, update.data.score.event);
		if (progResult === 'refresh') return 'refresh';
		if (isConfirmableMatchStatus(state.status)) {
			scorePatches.scheduleReconcile();
		}
		return 'applied';
	}

	let pageTitle = $derived(
		tieDetailData
			? `${tieDetailData.tie.teamAName ?? '?'} vs ${tieDetailData.tie.teamBName ?? '?'} | 東大リーグ`
			: '試合詳細 | 東大リーグ団体戦'
	);
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

{#snippet headerActions()}
	<RealtimeSync
		topics={['score', 'schedule'] as const}
		refresh={refreshAll}
		{applyUpdate}
		pollInterval={15000}
	/>
{/snippet}

<PageHeader title="試合詳細" actions={headerActions} />

{#if tieDetailData == null}
	<div class="space-y-4">
		<div class="h-28 animate-pulse rounded-2xl bg-zinc-200"></div>
		<div class="h-48 animate-pulse rounded-2xl bg-zinc-200"></div>
	</div>
{:else}
	<LiveTieDetail
		tie={tieDetailData.tie}
		{rubbers}
		progressionQuery={progression}
		bind:expandedRubberId
		onExpand={handleExpand}
	/>
{/if}
