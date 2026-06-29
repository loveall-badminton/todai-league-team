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
		players
	}: {
		events: EventRow[];
		games: GameState[];
		players: MatchPlayer[];
	} = $props();

	let scoresheetByGame = $derived(buildScoresheetByGame(events, games, players));
	let aPlayers = $derived(players.filter((p) => p.side === 'A'));
	let bPlayers = $derived(players.filter((p) => p.side === 'B'));
</script>

<Card class="overflow-hidden">
	{#each scoresheetByGame as game, gi (gi)}
		<div class={cn('pb-4', gi > 0 && 'border-t border-border pt-4')}>
			<div class="mb-3 flex items-center justify-between">
				<p class="text-xs font-medium tracking-wide text-muted">第{game.gameNo}ゲーム</p>
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
							<tr class={cn('w-fit border-b border-border-subtle')}>
								<td
									class="sticky left-0 z-10 border-r border-border bg-pink-50 px-2 py-1.5 font-medium whitespace-nowrap text-pink-800"
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
														class="flex min-w-7 items-center justify-center border-r border-border-subtle px-1 py-1.5 font-medium text-pink-700 tabular-nums"
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
													<div class="min-w-7 border-r border-border-subtle px-1 py-1.5"></div>
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
								class="sticky left-0 z-10 border-y-2 border-zinc-400 bg-zinc-100 px-2 py-0.5 text-center text-[10px] font-medium tracking-wider text-muted"
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
							<tr class={cn('w-fit border-b border-border-subtle')}>
								<td
									class="sticky left-0 z-10 border-r border-border bg-cyan-50 px-2 py-1.5 font-medium whitespace-nowrap text-cyan-800"
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
														class="flex min-w-7 items-center justify-center border-r border-border-subtle px-1 py-1.5 font-medium text-cyan-700 tabular-nums"
													>
														{entry.scoreB}
													</div>
												{/each}
												{#if ri < game.serviceRuns.length - 1}
													<div class="flex items-center border-r-2 border-zinc-300"></div>
												{/if}
											{:else}
												{#each run.scores as _entry (_entry.scoreA + '-' + _entry.scoreB)}
													<div class="min-w-7 border-r border-border-subtle px-1 py-1.5"></div>
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

			<div class="mt-2 flex items-center gap-4 text-[10px] text-muted">
				<span>太線 ＝ サービスオーバー</span>
				<span>数字 ＝ サーバー側得点</span>
			</div>
		</div>
	{:else}
		<div class="px-5 py-8 text-center text-sm text-muted">得点データがありません</div>
	{/each}
</Card>
