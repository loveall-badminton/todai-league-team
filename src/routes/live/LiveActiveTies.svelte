<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import type { RubberRow } from '$lib/components/TieRubberList.svelte';
	import TieRubberList from '$lib/components/TieRubberList.svelte';
	import { courtDisplayLabel, phaseLabel } from '$lib/domain/tokyoLeagueLabels';
	import type { PublicRubberSummary } from '$lib/server/services/liveBoardService';
	import { getActiveTies } from './live.remote';

	let { realtimeEnabled }: { realtimeEnabled: boolean } = $props();

	const activeTies = getActiveTies();

	$effect(() => {
		if (!realtimeEnabled) return;
		const id = setInterval(() => activeTies.refresh(), 8000);
		return () => clearInterval(id);
	});

	function toRubberRow(rubber: PublicRubberSummary): RubberRow {
		const statusSrc = rubber.matchStatus ?? rubber.status;
		return {
			id: rubber.id,
			code: rubber.code,
			status: rubber.status,
			winnerSide: rubber.winnerSide,
			playersA: rubber.sideAPlayers?.split(' / ').filter(Boolean) ?? [],
			playersB: rubber.sideBPlayers?.split(' / ').filter(Boolean) ?? [],
			loserLabel: statusSrc === 'forfeited' ? '棄権' : statusSrc === 'retired' ? 'リタイア' : null,
			gamesScore: rubber.gamesScore,
			gameDetails: rubber.gameDetails
		};
	}
</script>

{#if activeTies.current == null}
	<section class="space-y-3">
		<div class="h-3 w-16 animate-pulse rounded-full bg-zinc-200"></div>
		<div class="grid gap-4 md:grid-cols-2">
			{#each [0, 1] as i (i)}
				<div class="animate-pulse overflow-hidden rounded-2xl border border-zinc-100 bg-white">
					<div class="space-y-2 px-5 pt-4 pb-3">
						<div class="h-2.5 w-24 rounded-full bg-zinc-200"></div>
						<div class="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
							<div class="h-5 w-20 rounded-full bg-zinc-200"></div>
							<div class="h-8 w-14 rounded-lg bg-zinc-200"></div>
							<div class="ml-auto h-5 w-20 rounded-full bg-zinc-200"></div>
						</div>
					</div>
					<div class="space-y-2.5 border-t border-zinc-100 px-5 py-3">
						{#each [0, 1, 2, 3] as j (j)}
							<div class="h-3 rounded-full bg-zinc-100" style="width: {60 + j * 8}%"></div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</section>
{:else if activeTies.current.ties.length > 0}
	{@const { ties, rubbersByTieId } = activeTies.current}
	<section class="space-y-3">
		<h2 class="text-xs font-semibold tracking-wider text-zinc-400">進行中</h2>
		<div class="grid gap-4 md:grid-cols-2">
			{#each ties as tie (tie.id)}
				{@const tieRubbers = rubbersByTieId[tie.id] ?? []}
				<Card class="overflow-hidden border-emerald-200">
					<div class="px-5 pt-4 pb-3">
						<p class="text-xs font-medium text-zinc-400">
							{phaseLabel(tie.phase)} · {tie.tieCode}
						</p>
						<p class="mt-1 text-[11px] text-zinc-400">
							コート: {courtDisplayLabel(tie.venue, tie.courtBlockCode)}
						</p>
						<div class="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
							<p class="min-w-0 truncate font-semibold">{tie.teamAName ?? '未定'}</p>
							<div class="text-center">
								<p class="text-3xl leading-none font-bold text-emerald-700 tabular-nums">
									{tie.teamScoreA}<span class="mx-1 text-emerald-300">–</span>{tie.teamScoreB}
								</p>
							</div>
							<p class="min-w-0 truncate text-right font-semibold">{tie.teamBName ?? '未定'}</p>
						</div>
					</div>
					{#if tieRubbers.length > 0}
						<div class="border-t border-zinc-100">
							<TieRubberList
								rubbers={tieRubbers.map(toRubberRow)}
								teamAName={tie.teamAName ?? ''}
								teamBName={tie.teamBName ?? ''}
							/>
						</div>
					{/if}
				</Card>
			{/each}
		</div>
	</section>
{/if}
