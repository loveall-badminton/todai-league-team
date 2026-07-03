<script lang="ts">
	import { page } from '$app/state';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import RealtimeSync from '$lib/components/RealtimeSync.svelte';
	import LiveTieDetail from './LiveTieDetail.svelte';
	import { hasScoreUpdate } from '$lib/realtime/channels';
	import type { MatchState } from '$lib/domain/types';
	import { isConfirmableMatchStatus, rubberStatusForMatchStatus } from '$lib/domain/matchStatus';
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

	// remote query の値は $state.raw で保持されており、直接ミューテーションしても
	// 再描画されない。リアルタイム更新は $state のパッチとして持ち、
	// query 由来のベースにマージした $derived を表示に使う。
	type RubberSummary = TiePageData['rubbers'][number];
	let scorePatches = $state<Record<string, Partial<RubberSummary>>>({});
	let rubbers = $derived(
		(tieDetailData?.rubbers ?? []).map((rubber) =>
			rubber.matchId && scorePatches[rubber.matchId]
				? { ...rubber, ...scorePatches[rubber.matchId] }
				: rubber
		)
	);

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

	function buildScorePatch(state: MatchState): Partial<RubberSummary> {
		const currentGame = state.games.find((g) => g.gameNo === state.currentGameNo);
		const patch: Partial<RubberSummary> = {
			gamesScore: `${state.gamesWon.A}-${state.gamesWon.B}`,
			pointScore: currentGame ? `${currentGame.score.A}-${currentGame.score.B}` : null,
			gameDetails: state.games.map((g) => ({
				gameNo: g.gameNo,
				scoreA: g.score.A,
				scoreB: g.score.B,
				winnerSide: g.winnerSide
			})),
			matchStatus: state.status,
			winnerSide: state.winnerSide
		};
		const rubberStatus = rubberStatusForMatchStatus(state.status);
		// 未開始(scheduled)への巻き戻しはこの画面では扱わないため上書きしない
		if (rubberStatus && rubberStatus !== 'scheduled') patch.status = rubberStatus;
		return patch;
	}

	// tie-detail のエッジキャッシュ(TTL 3秒)を跨いでから取り直す。
	// 即時 refresh だと更新前のキャッシュを引いてローカル適用済みの表示を巻き戻すことがある。
	const RECONCILE_DELAY_MS = 4000;
	let reconcileTimer: ReturnType<typeof setTimeout> | null = null;

	function scheduleReconcileRefresh() {
		if (reconcileTimer !== null) return;
		reconcileTimer = setTimeout(() => {
			reconcileTimer = null;
			tieDetailQuery.refresh();
			if (expandedRubberId !== null) void loadProgression();
		}, RECONCILE_DELAY_MS);
	}

	$effect(() => {
		return () => {
			if (reconcileTimer !== null) clearTimeout(reconcileTimer);
		};
	});

	function refreshAll() {
		tieDetailQuery.refresh();
		if (expandedRubberId !== null) void loadProgression();
	}

	function applyUpdate(update: RealtimeUpdate): 'applied' | 'refresh' | 'ignore' {
		if (!update.data || !hasScoreUpdate(update.data)) {
			if (update.topics.includes('schedule') && update.data?.schedule?.tieIds?.includes(tieId)) {
				return 'refresh';
			}
			return 'ignore';
		}
		const state = update.data.score.state;
		const rubber = rubbers.find((r) => r.matchId === state.matchId);
		if (!rubber) return 'ignore';
		scorePatches[state.matchId] = buildScorePatch(state);
		const progResult = applyProgressionEvent(state.matchId, update.data.score.event);
		if (progResult === 'refresh') return 'refresh';
		if (isConfirmableMatchStatus(state.status)) {
			// スコアはローカル適用済み。ヘッダーの対戦スコア等はキャッシュ失効後に取り直す
			scheduleReconcileRefresh();
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
