<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import type { GameState, MatchPlayer } from '$lib/domain/types';
	import { cn } from '$lib/utils/cn';

	interface EventRow {
		seqNo: number;
		eventType: string;
		side: string | null;
		gameNo: number | null;
		scoreAAfter: number | null;
		scoreBAfter: number | null;
		serverPlayerIdBefore: string | null;
		serverPlayerIdAfter: string | null;
		receiverPlayerIdBefore: string | null;
		receiverPlayerIdAfter: string | null;
		targetSeqNo: number | null;
	}

	interface ScoreEntry {
		scoreA: number;
		scoreB: number;
		isServiceOver: boolean;
	}

	interface ServiceRun {
		serverPlayerId: string;
		side: 'A' | 'B';
		scores: ScoreEntry[];
	}

	interface GameSheet {
		gameNo: number;
		serviceRuns: ServiceRun[];
		finalScoreA: number;
		finalScoreB: number;
		winnerSide: 'A' | 'B' | null;
	}

	let {
		events,
		games,
		sideAPlayers,
		sideBPlayers,
		players
	}: {
		events: EventRow[];
		games: GameState[];
		sideAPlayers: MatchPlayer[];
		sideBPlayers: MatchPlayer[];
		players: MatchPlayer[];
	} = $props();

	let scoresheetByGame = $derived.by((): GameSheet[] => {
		const allEvents = [...events].sort((a, b) => a.seqNo - b.seqNo);

		// Exclude events that have been undone
		const undoneSeqNos = new Set(
			allEvents
				.filter((e) => e.eventType === 'undo_applied' && e.targetSeqNo != null)
				.map((e) => e.targetSeqNo!)
		);
		const activeEvents = allEvents.filter(
			(e) => e.eventType !== 'undo_applied' && !undoneSeqNos.has(e.seqNo)
		);

		const result: GameSheet[] = [];
		let currentGameNo = 1;
		let runs: ServiceRun[] = [];
		let currentRun: ServiceRun | null = null;
		let lastScoreA = 0;
		let lastScoreB = 0;

		for (const ev of activeEvents) {
			if (ev.eventType === 'game_started' && ev.gameNo && ev.gameNo > currentGameNo) {
				if (currentRun) runs.push(currentRun);
				{
					const gs = games.find((g) => g.gameNo === currentGameNo);
					result.push({
						gameNo: currentGameNo,
						serviceRuns: runs,
						finalScoreA: gs?.score.A ?? lastScoreA,
						finalScoreB: gs?.score.B ?? lastScoreB,
						winnerSide: gs?.winnerSide ?? null
					});
				}
				currentGameNo = ev.gameNo;
				runs = [];
				currentRun = null;
				lastScoreA = 0;
				lastScoreB = 0;
			}

			if (ev.eventType === 'match_started') {
				const serverId = ev.serverPlayerIdAfter;
				const receiverId = ev.receiverPlayerIdAfter;
				const serverSide = players.find((p) => p.id === serverId)?.side ?? ('A' as 'A' | 'B');
				const receiverSide = players.find((p) => p.id === receiverId)?.side ?? ('B' as 'A' | 'B');

				currentRun = {
					serverPlayerId: serverId ?? '',
					side: serverSide,
					scores: [{ scoreA: 0, scoreB: 0, isServiceOver: false }]
				};

				runs.push({
					serverPlayerId: receiverId ?? '',
					side: receiverSide,
					scores: [{ scoreA: 0, scoreB: 0, isServiceOver: true }]
				});
			}

			if (ev.eventType === 'game_started' && ev.gameNo && ev.gameNo === currentGameNo) {
				const serverId = ev.serverPlayerIdAfter;
				const receiverId = ev.receiverPlayerIdAfter;
				const serverSide = players.find((p) => p.id === serverId)?.side ?? ('A' as 'A' | 'B');
				const receiverSide = players.find((p) => p.id === receiverId)?.side ?? ('B' as 'A' | 'B');

				runs.push({
					serverPlayerId: receiverId ?? '',
					side: receiverSide,
					scores: [{ scoreA: 0, scoreB: 0, isServiceOver: true }]
				});

				currentRun = {
					serverPlayerId: serverId ?? '',
					side: serverSide,
					scores: [{ scoreA: 0, scoreB: 0, isServiceOver: false }]
				};
			}

			if (ev.eventType === 'rally_won' && ev.scoreAAfter !== null && ev.scoreBAfter !== null) {
				let scoreA = ev.scoreAAfter;
				let scoreB = ev.scoreBAfter;
				const serverBefore = ev.serverPlayerIdBefore;
				const serverAfter = ev.serverPlayerIdAfter;
				// When game/match ends, service is cleared (serverAfter = null).
				// Historical events may have scoreAAfter=0 due to a recording bug; use the
				// game state's actual final score instead.
				if (serverAfter === null) {
					const gs = games.find((g) => g.gameNo === currentGameNo);
					if (gs && gs.winnerSide) {
						scoreA = gs.score.A;
						scoreB = gs.score.B;
					}
				}
				// Use ev.side vs the server's side to detect if the receiver won the game-ending point.
				const serverBeforeSide = players.find((p) => p.id === serverBefore)?.side;
				const serviceChanged =
					serverAfter !== null
						? serverBefore !== serverAfter
						: ev.side !== null && serverBeforeSide !== undefined && ev.side !== serverBeforeSide;

				if (serviceChanged && currentRun) {
					if (currentRun.scores.length > 0) {
						currentRun.scores[currentRun.scores.length - 1].isServiceOver = true;
					}
					runs.push(currentRun);
					// Use serverAfter normally; fall back to receiverPlayerIdBefore for game-ending rallies
					const newServerId = serverAfter ?? ev.receiverPlayerIdBefore ?? '';
					const newServerSide =
						players.find((p) => p.id === newServerId)?.side ?? ('A' as 'A' | 'B');
					currentRun = {
						serverPlayerId: newServerId,
						side: newServerSide,
						scores: [{ scoreA, scoreB, isServiceOver: false }]
					};
				} else if (currentRun) {
					currentRun.scores.push({ scoreA, scoreB, isServiceOver: false });
				} else {
					const sid = serverAfter ?? '';
					const ss = players.find((p) => p.id === sid)?.side ?? ('A' as 'A' | 'B');
					currentRun = {
						serverPlayerId: sid,
						side: ss,
						scores: [{ scoreA, scoreB, isServiceOver: false }]
					};
				}

				lastScoreA = scoreA;
				lastScoreB = scoreB;
			}
		}

		if (currentRun) runs.push(currentRun);
		if (runs.length > 0) {
			const gs = games.find((g) => g.gameNo === currentGameNo);
			result.push({
				gameNo: currentGameNo,
				serviceRuns: runs,
				finalScoreA: gs?.score.A ?? lastScoreA,
				finalScoreB: gs?.score.B ?? lastScoreB,
				winnerSide: gs?.winnerSide ?? null
			});
		}

		return result;
	});
</script>

<Card class="overflow-hidden">
	<div class="border-b border-zinc-100 px-5 py-3">
		<h2 class="text-sm font-medium text-zinc-700">スコアシート</h2>
	</div>
	{#each scoresheetByGame as game, gi (gi)}
		{@const aPlayers = sideAPlayers}
		{@const bPlayers = sideBPlayers}
		<div class="px-3 py-4 {gi > 0 ? 'border-t border-zinc-200' : ''}">
			<div class="mb-3 flex items-center justify-between">
				<p class="text-xs font-medium tracking-wide text-zinc-400">第{game.gameNo}ゲーム</p>
				{#if game.winnerSide}
					<span
						class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold
								{game.winnerSide === 'A' ? 'bg-pink-100 text-pink-700' : 'bg-cyan-100 text-cyan-700'}"
					>
						{game.finalScoreA}–{game.finalScoreB}
					</span>
				{/if}
			</div>

			<div class="overflow-x-auto">
				<table class="w-full border-collapse text-xs">
					<tbody>
						{#each aPlayers as player (player.id)}
							{@const playerRuns = game.serviceRuns.filter((r) => r.serverPlayerId === player.id)}
							<tr class={cn('w-fit border-b border-zinc-100')}>
								<td
									class="sticky left-0 z-10 border-r border-zinc-200 bg-pink-50 px-2 py-1.5 font-medium whitespace-nowrap text-pink-800"
									style="min-width: 5rem; max-width: 7rem;"
								>
									<div class="flex items-center gap-1 truncate">
										<span class="truncate">{player.name}</span>
									</div>
								</td>
								<td class="p-0">
									<div class="flex items-stretch">
										{#each game.serviceRuns as run, ri (ri)}
											{#if run.serverPlayerId === player.id}
												{#each run.scores as entry (entry.scoreA + '-' + entry.scoreB + '-' + entry.isServiceOver)}
													<div
														class="flex min-w-7 items-center justify-center border-r border-zinc-100 px-1 py-1.5 font-medium text-pink-700 tabular-nums"
													>
														{entry.scoreA}
													</div>
												{/each}
												{#if ri < game.serviceRuns.length - 1}
													<div class="flex items-center border-r-2 border-zinc-300"></div>
												{/if}
											{:else}
												{#each run.scores as _entry (_entry.scoreA + '-' + _entry.scoreB)}
													<div class="min-w-7 border-r border-zinc-100 px-1 py-1.5"></div>
												{/each}
												{#if ri < game.serviceRuns.length - 1}
													<div class="flex items-center border-r-2 border-zinc-300"></div>
												{/if}
											{/if}
										{/each}
										{#if playerRuns.length === 0 && game.serviceRuns.length === 0}
											<div class="px-2 py-1.5 text-zinc-300">—</div>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>

					<tbody>
						<tr>
							<td
								class="sticky left-0 z-10 border-y-2 border-zinc-400 bg-zinc-100 px-2 py-0.5 text-center text-[10px] font-medium tracking-wider text-zinc-400"
							>
								—
							</td>
							<td class="border-y-2 border-zinc-400 bg-zinc-100 p-0">
								<div class="flex items-stretch">
									{#each game.serviceRuns as run, ri (ri)}
										{#each run.scores as _entry (_entry.scoreA + '-' + _entry.scoreB)}
											<div class="min-w-7 border-r border-zinc-300 px-1 py-0.5"></div>
										{/each}
										{#if ri < game.serviceRuns.length - 1}
											<div class="border-r-2 border-zinc-300"></div>
										{/if}
									{/each}
								</div>
							</td>
						</tr>
					</tbody>

					<tbody>
						{#each bPlayers as player (player.id)}
							{@const playerRuns = game.serviceRuns.filter((r) => r.serverPlayerId === player.id)}
							<tr class={cn('w-fit border-b border-zinc-100')}>
								<td
									class="sticky left-0 z-10 border-r border-zinc-200 bg-cyan-50 px-2 py-1.5 font-medium whitespace-nowrap text-cyan-800"
									style="min-width: 5rem; max-width: 7rem;"
								>
									<div class="flex items-center gap-1 truncate">
										<span class="truncate">{player.name}</span>
									</div>
								</td>
								<td class="p-0">
									<div class="flex items-stretch">
										{#each game.serviceRuns as run, ri (ri)}
											{#if run.serverPlayerId === player.id}
												{#each run.scores as entry (entry.scoreA + '-' + entry.scoreB + '-' + entry.isServiceOver)}
													<div
														class="flex min-w-7 items-center justify-center border-r border-zinc-100 px-1 py-1.5 font-medium text-cyan-700 tabular-nums"
													>
														{entry.scoreB}
													</div>
												{/each}
												{#if ri < game.serviceRuns.length - 1}
													<div class="flex items-center border-r-2 border-zinc-300"></div>
												{/if}
											{:else}
												{#each run.scores as _entry (_entry.scoreA + '-' + _entry.scoreB)}
													<div class="min-w-7 border-r border-zinc-100 px-1 py-1.5"></div>
												{/each}
												{#if ri < game.serviceRuns.length - 1}
													<div class="flex items-center border-r-2 border-zinc-300"></div>
												{/if}
											{/if}
										{/each}
										{#if playerRuns.length === 0 && game.serviceRuns.length === 0}
											<div class="px-2 py-1.5 text-zinc-300">—</div>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="mt-2 flex items-center gap-4 text-[10px] text-zinc-400">
				<span>太線 ＝ サービスオーバー</span>
				<span>数字 ＝ サーバー側得点</span>
			</div>
		</div>
	{:else}
		<div class="px-5 py-8 text-center text-sm text-zinc-400">得点データがありません</div>
	{/each}
</Card>
