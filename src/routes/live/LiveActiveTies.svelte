<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import {
		courtDisplayLabel,
		phaseLabel,
		rubberLabel,
		rubberStatusLabel
	} from '$lib/domain/tokyoLeagueLabels';
	import type { PublicRubberSummary } from '$lib/server/services/liveBoardService';
	import type { LivePageData } from '$lib/server/services/livePageService';
	import type { QueryValue } from '$lib/utils/types';
	import { cn } from '$lib/utils/cn';
	import { ChevronDown } from '@lucide/svelte';
	import ScoreProgressChart from './ScoreProgressChart.svelte';

	type TieRubber = NonNullable<LivePageData['activeTies']>['rubbersByTieId'][string][number];

	let {
		query,
		progressionQuery
	}: {
		query: QueryValue<LivePageData['activeTies']>;
		progressionQuery: QueryValue<LivePageData['progression']>;
	} = $props();

	function progressionPoints(
		rubber: PublicRubberSummary,
		byMatchId: NonNullable<typeof progressionQuery.current>['byMatchId']
	) {
		if (!rubber.matchId) return [];
		return byMatchId[rubber.matchId] ?? [];
	}

	let byMatchId = $derived(progressionQuery.current?.byMatchId ?? {});
	let expandedRubberId = $state<string | null>(null);

	function toggleRubber(rubberId: string) {
		expandedRubberId = expandedRubberId === rubberId ? null : rubberId;
	}
</script>

{#snippet rubberScore(rubber: TieRubber)}
	{@const isPlaying = rubber.status === 'playing'}
	{#if rubber.gamesScore !== null}
		<div class="text-center">
			<p
				class={cn(
					'text-xs tabular-nums leading-tight',
					rubber.winnerSide
						? 'font-extrabold text-emerald-700'
						: isPlaying
							? 'font-bold text-emerald-700'
							: 'font-bold text-zinc-600'
				)}
			>
				{rubber.gamesScore}
			</p>
			{#each rubber.gameDetails as g (g.gameNo)}
				<p
					class={cn(
						'text-[10px] tabular-nums',
						isPlaying && g.gameNo === rubber.gameDetails.length
							? 'font-medium text-emerald-500'
							: 'text-zinc-400'
					)}
				>
					{g.scoreA}–{g.scoreB}
				</p>
			{/each}
		</div>
	{:else}
		<span class="text-center text-xs text-zinc-400">{rubberStatusLabel(rubber.status)}</span>
	{/if}
{/snippet}

{#if query.current == null}
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
{:else if query.current.ties.length > 0}
	{@const { ties, rubbersByTieId } = query.current}
	<section class="space-y-3">
		<h2 class="text-xs font-semibold tracking-wider text-zinc-400">進行中</h2>
		<div class="grid gap-4 md:grid-cols-2">
			{#each ties as tie (tie.id)}
				{@const tieRubbers = rubbersByTieId[tie.id] ?? []}
				{@const hasPlayingRubber = tieRubbers.some((r: TieRubber) => r.status === 'playing')}
				<Card class="overflow-hidden {hasPlayingRubber ? 'border-emerald-200' : ''}">
					<div class="px-5 pt-4 pb-3">
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0">
								<p class="text-xs font-medium text-zinc-400">
									{phaseLabel(tie.phase)} · {tie.tieCode}
								</p>
								<p class="mt-0.5 text-[11px] text-zinc-400">
									コート: {courtDisplayLabel(tie.venue, tie.courtBlockCode)}
								</p>
							</div>
						</div>
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
							{#each tieRubbers as rubber (rubber.id)}
								{@const isPlaying = rubber.status === 'playing'}
								{@const isExpanded = expandedRubberId === rubber.id}
								{@const points = progressionPoints(rubber, byMatchId)}
								{#snippet playerNames(ids: string, side: 'A' | 'B')}
									{@const names = ids.split(' / ').filter(Boolean)}
									{#if names.length > 0}
										<div class="min-w-0 space-y-0.5">
											{#each names as name, i (name + i)}
												<div class={cn('truncate', side === 'A' ? '' : 'text-right')}>{name}</div>
											{/each}
										</div>
									{:else}
										<span class="text-zinc-400">—</span>
									{/if}
								{/snippet}
								<button
									type="button"
									class="flex w-full items-center gap-x-2 border-b border-zinc-50 px-4 py-2 text-left text-xs transition-colors hover:bg-zinc-50 {isPlaying
										? 'bg-emerald-50/50'
										: ''}"
									onclick={() => toggleRubber(rubber.id)}
								>
									<span class="w-10 shrink-0 font-medium text-zinc-400"
										>{rubberLabel(rubber.code)}</span
									>
									<div class="min-w-0 flex-1">
										{@render playerNames(rubber.sideAPlayers ?? '', 'A')}
									</div>
									<div class="shrink-0">{@render rubberScore(rubber)}</div>
									<div class="min-w-0 flex-1">
										{@render playerNames(rubber.sideBPlayers ?? '', 'B')}
									</div>
									<ChevronDown
										class={cn(
											'ml-1 size-3.5 shrink-0 text-zinc-300 transition-transform',
											isExpanded && 'rotate-180'
										)}
									/>
								</button>
								{#key rubber.id}
									{@const currentScore = points.length > 0 ? points[points.length - 1] : null}
									<div
										class="grid transition-all duration-200 ease-out data-[state=closed]:grid-rows-[0fr] data-[state=open]:grid-rows-[1fr]"
										data-state={isExpanded ? 'open' : 'closed'}
									>
										<div class="overflow-hidden">
											<div class="border-b border-zinc-100 bg-zinc-50 px-5 py-3">
												<div class="mb-2 flex items-end justify-between gap-3">
													<span class="text-xs font-semibold tracking-wide text-zinc-400">
														スコア推移
													</span>
													{#if currentScore}
														<p class="text-base leading-none font-bold tabular-nums">
															<span class="text-pink-600">{currentScore.scoreA}</span>
															<span class="mx-1 text-zinc-300">–</span>
															<span class="text-cyan-600">{currentScore.scoreB}</span>
														</p>
													{/if}
												</div>
												{#if points.length > 0}
													<ScoreProgressChart
														{points}
														nameA={tie.teamAName ?? 'A'}
														nameB={tie.teamBName ?? 'B'}
													/>
												{:else}
													<p class="py-4 text-center text-xs text-zinc-400">
														スコアデータがありません
													</p>
												{/if}
											</div>
										</div>
									</div>
								{/key}
							{/each}
						</div>
					{/if}
				</Card>
			{/each}
		</div>
	</section>
{/if}
