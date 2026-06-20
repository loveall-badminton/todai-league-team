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
	import { getLivePageData } from './live.remote';
	import {
		applyRealtimeProgressionEvent,
		type ProgressionRealtimeState
	} from './progressionRealtime';

	const liveQuery = getLivePageData();
	let liveData = $derived(await liveQuery);

	// svelte-ignore state_referenced_locally
	let activeTies = $state({ current: liveData.activeTies });
	// svelte-ignore state_referenced_locally
	let progression = $state({ current: liveData.progression });
	// svelte-ignore state_referenced_locally
	let progressionEvents = $state(liveData.progression.eventsByMatchId);

	// それ以外はフルリフレッシュ時のみ更新（$derived で liveData を追跡）
	let standings = $derived({ current: liveData.standings });
	let finalsBoard = $derived({ current: liveData.finalsBoard });
	let schedule = $derived({ current: liveData.schedule });

	// liveQuery.refresh() 後に $derived が更新 → $state も同期
	$effect(() => {
		const d = liveData;
		activeTies = { current: d.activeTies };
		progression = { current: d.progression };
		progressionEvents = d.progression.eventsByMatchId;
	});
	const refreshTopics = createRealtimeQueryFlow({
		refresh: () => liveQuery.refresh(),
		applyUpdate: (update: RealtimeUpdate) => {
			if (!hasScoreUpdate(update.data) || !activeTies.current) return 'refresh';
			const state = update.data.score.state;
			applyScoreToActiveTies(activeTies.current, state);
			applyProgressionEvent(state.matchId, update.data.score.event);
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
	) {
		const prog = progression.current;
		if (!prog) return;
		const next = applyRealtimeProgressionEvent(matchId, scoreEvent, {
			byMatchId: prog.byMatchId,
			eventsByMatchId: progressionEvents
		} satisfies ProgressionRealtimeState);
		if (next === null) return;
		if (next === 'refresh') {
			void liveQuery.refresh();
			return;
		}
		progressionEvents = next.eventsByMatchId;
		prog.byMatchId = next.byMatchId;
	}

	function applyScoreToActiveTies(
		data: {
			ties: { id: string }[];
			rubbersByTieId: Record<
				string,
				{
					matchId: string | null;
					gamesScore: string | null;
					pointScore: string | null;
					gameDetails: { gameNo: number; scoreA: number; scoreB: number }[];
					matchStatus: string | null;
					status: string;
					winnerSide: string | null;
				}[]
			>;
		},
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
		<div class="flex items-center gap-2 text-xs text-zinc-400">
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
