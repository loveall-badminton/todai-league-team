<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import { cn } from '$lib/utils/cn';
	import {
		buildScoresheetByGame,
		type EventRow,
		type GameState,
		type MatchPlayer
	} from './scoresheetHelpers';

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

	let scoresheetByGame = $derived(buildScoresheetByGame(events, games, players));
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
												{#each run.scores as entry, si (ri + '-' + si)}
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
												<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
												{#each run.scores as _entry, si (ri + '-' + si)}
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
										<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
										{#each run.scores as _entry, si (ri + '-' + si)}
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
