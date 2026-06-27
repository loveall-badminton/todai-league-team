<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import RealtimeSync from '$lib/components/RealtimeSync.svelte';
	import LiveActiveTies from './LiveActiveTies.svelte';
	import LiveStandings from './LiveStandings.svelte';
	import LiveFinalsBoard from './LiveFinalsBoard.svelte';
	import LiveSchedule from './LiveSchedule.svelte';
	import { ALL_LIVE_TOPICS, hasScoreUpdate } from '$lib/realtime/channels';
	import type { MatchState } from '$lib/domain/types';
	import { createRealtimeQueryFlow } from '$lib/realtime/queryFlow';
	import type { RealtimeUpdate } from '$lib/realtime/updates';
	import { getLivePageData, getScoreProgression } from './live.remote';
	import type { LivePageData } from '$lib/server/services/livePageService';
	import {
		applyRealtimeProgressionEvent,
		type ProgressionRealtimeState
	} from './progressionRealtime';

	const liveQuery = getLivePageData();
	let liveData = $derived(await liveQuery);

	// svelte-ignore state_referenced_locally
	// eslint-disable-next-line svelte/prefer-writable-derived -- activeTies is also mutated in-place for optimistic score updates
	let activeTies = $state<{ current: LivePageData['activeTies'] | null }>({
		current: liveData.activeTies
	});
	// スコアグラフは遅延読み込み（必要なときだけ D1 クエリを発行）
	let progression = $state<{ current: ProgressionRealtimeState | null }>({ current: null });

	async function loadProgression() {
		try {
			const data = await getScoreProgression();
			progression = { current: data };
		} catch {
			// スコアグラフの読み込みは非重要。失敗しても画面は表示できる。
		}
	}
	loadProgression();

	// それ以外はフルリフレッシュ時のみ更新（$derived で liveData を追跡）
	let standings = $derived({ current: liveData.standings });
	let finalsBoard = $derived({ current: liveData.finalsBoard });
	let schedule = $derived({ current: liveData.schedule });

	$effect(() => {
		activeTies = { current: liveData.activeTies };
	});

	const refreshTopics = createRealtimeQueryFlow({
		refresh: () => {
			liveQuery.refresh();
			loadProgression();
		},
		applyUpdate: (update: RealtimeUpdate) => {
			if (!hasScoreUpdate(update.data) || !activeTies.current) return 'refresh';
			const state = update.data.score.state;
			applyScoreToActiveTies(activeTies.current, state);
			const progResult = applyProgressionEvent(state.matchId, update.data.score.event);
			if (progResult === 'refresh') return 'refresh';
			if (['finished', 'forfeited', 'retired'].includes(state.status)) {
				return 'refresh';
			}
			return 'applied';
		},
		shouldRefresh: (update: RealtimeUpdate) => update.topics.length > 0
	});

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

	function applyScoreToActiveTies(
		data: NonNullable<LivePageData['activeTies']>,
		state: MatchState
	) {
		for (const tie of data.ties) {
			const rubbers = data.rubbersByTieId[tie.id];
			if (!rubbers) continue;
			const rubber = rubbers.find((r) => r.matchId === state.matchId);
			if (!rubber) continue;
			const currentGame = state.games.find((g) => g.gameNo === state.currentGameNo);
			rubber.gamesScore = `${state.gamesWon.A}-${state.gamesWon.B}`;
			rubber.pointScore = currentGame ? `${currentGame.score.A}-${currentGame.score.B}` : null;
			rubber.gameDetails = state.games.map((g) => ({
				gameNo: g.gameNo,
				scoreA: g.score.A,
				scoreB: g.score.B
			}));
			rubber.matchStatus = state.status;
			rubber.winnerSide = state.winnerSide;
			if (state.status === 'confirmed') rubber.status = 'confirmed';
			else if (['finished', 'forfeited', 'retired'].includes(state.status))
				rubber.status = 'finished';
			else if (['playing', 'interval', 'suspended'].includes(state.status))
				rubber.status = 'playing';
			else if (state.status === 'cancelled') rubber.status = 'cancelled';
			return;
		}
	}
</script>

<svelte:head>
	<title>ライブ | 東大リーグ団体戦</title>
</svelte:head>

{#snippet headerActions()}
	<div class="flex items-center gap-3">
		<div class="flex items-center gap-2 text-xs text-muted">
			<span class="flex items-center gap-1.5">
				<span class="relative flex size-2">
					{#if (activeTies.current?.ties.length ?? 0) > 0}
						<span
							class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
						></span>
					{/if}
					<span
						class="relative inline-flex size-2 rounded-full {(activeTies.current?.ties.length ??
							0) > 0
							? 'bg-emerald-500'
							: 'bg-zinc-300'}"
					></span>
				</span>
				{(activeTies.current?.ties.length ?? 0) > 0
					? `${activeTies.current!.ties.length}試合進行中`
					: '進行中の試合なし'}
			</span>
		</div>
		<RealtimeSync
			topics={ALL_LIVE_TOPICS}
			onUpdate={(u) => void refreshTopics(u)}
			pollInterval={8000}
		/>
	</div>
{/snippet}

<PageHeader title="ライブ表示" actions={headerActions} />

<LiveActiveTies query={activeTies} progressionQuery={progression} />
<LiveStandings query={standings} />
<LiveFinalsBoard query={finalsBoard} />
<LiveSchedule query={schedule} />
