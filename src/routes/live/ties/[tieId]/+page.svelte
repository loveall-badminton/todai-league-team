<script lang="ts">
	import { page } from '$app/state';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import RealtimeSync from '$lib/components/RealtimeSync.svelte';
	import LiveTieDetail from './LiveTieDetail.svelte';
	import { hasScoreUpdate } from '$lib/realtime/channels';
	import type { MatchState } from '$lib/domain/types';
	import { createRealtimeQueryFlow } from '$lib/realtime/queryFlow';
	import type { RealtimeUpdate } from '$lib/realtime/updates';
	import { getTieDetail, getTieProgression } from './tie-detail.remote';
	import type { TiePageData } from '$lib/server/services/liveBoardService';
	import {
		applyRealtimeProgressionEvent,
		type ProgressionRealtimeState
	} from '../../progressionRealtime';

	// tieId is always present for this route
	const tieId = page.params.tieId!;

	const tieDetailQuery = getTieDetail(tieId);
	let tieDetailData = $derived(await tieDetailQuery);

	let rubbers = $derived<TiePageData['rubbers']>(tieDetailData?.rubbers ?? []);

	let progression = $state<{ current: ProgressionRealtimeState | null }>({ current: null });
	let expandedRubberId = $state<string | null>(null);
	let progressionEverLoaded = false;

	async function loadProgression() {
		try {
			const data = await getTieProgression(tieId);
			progression = { current: data };
		} catch {
			// non-critical — chart just shows skeleton/no-data
		}
	}

	function handleExpand() {
		if (!progressionEverLoaded) {
			progressionEverLoaded = true;
			void loadProgression();
		}
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

	function applyScoreToRubber(rubber: TiePageData['rubbers'][number], state: MatchState) {
		const currentGame = state.games.find((g) => g.gameNo === state.currentGameNo);
		rubber.gamesScore = `${state.gamesWon.A}-${state.gamesWon.B}`;
		rubber.pointScore = currentGame ? `${currentGame.score.A}-${currentGame.score.B}` : null;
		rubber.gameDetails = state.games.map((g) => ({
			gameNo: g.gameNo,
			scoreA: g.score.A,
			scoreB: g.score.B,
			winnerSide: g.winnerSide
		}));
		rubber.matchStatus = state.status;
		rubber.winnerSide = state.winnerSide;
		if (state.status === 'confirmed') rubber.status = 'confirmed';
		else if (['finished', 'forfeited', 'retired'].includes(state.status))
			rubber.status = 'finished';
		else if (['playing', 'interval', 'suspended'].includes(state.status)) rubber.status = 'playing';
		else if (state.status === 'cancelled') rubber.status = 'cancelled';
	}

	const refreshTopics = createRealtimeQueryFlow({
		refresh: () => {
			tieDetailQuery.refresh();
			if (expandedRubberId !== null) loadProgression();
		},
		applyUpdate: (update: RealtimeUpdate) => {
			if (!update.data || !hasScoreUpdate(update.data)) {
				if (update.topics.includes('schedule') && update.data?.schedule?.tieIds?.includes(tieId)) {
					return 'refresh';
				}
				return 'ignore';
			}
			const state = update.data.score.state;
			const rubber = rubbers.find((r) => r.matchId === state.matchId);
			if (!rubber) return 'ignore';
			applyScoreToRubber(rubber, state);
			const progResult = applyProgressionEvent(state.matchId, update.data.score.event);
			if (progResult === 'refresh') return 'refresh';
			if (['finished', 'forfeited', 'retired'].includes(state.status)) return 'refresh';
			return 'applied';
		}
	});

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
		onUpdate={(u) => void refreshTopics(u)}
		pollInterval={8000}
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
