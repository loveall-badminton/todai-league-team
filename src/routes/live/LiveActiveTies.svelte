<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import {
		courtDisplayLabel,
		phaseLabel,
		rubberLabel,
		rubberStatusLabel
	} from '$lib/domain/tokyoLeagueLabels';
	import type { LivePageData, ScoreProgressionData } from '$lib/server/services/livePageService';
	import type { QueryValue } from '$lib/utils/types';
	import { cn } from '$lib/utils/cn';
	import AppTabs from '$lib/components/AppTabs.svelte';
	import { ChevronDown } from '@lucide/svelte';
	import SectionLabel from '$lib/components/SectionLabel.svelte';
	import ScoreProgressChart from './ScoreProgressChart.svelte';
	import { filterScorePointsByGame, getScoreProgressionGameNos } from '$lib/utils/scoreProgression';

	type TieRubber = NonNullable<LivePageData['activeTies']>['rubbersByTieId'][string][number];

	let {
		query,
		progressionQuery
	}: {
		query: QueryValue<LivePageData['activeTies']>;
		progressionQuery: QueryValue<ScoreProgressionData | null>;
	} = $props();

	function progressionPoints(
		rubber: TieRubber,
		byMatchId: NonNullable<typeof progressionQuery.current>['byMatchId']
	) {
		if (!rubber.matchId) return [];
		return byMatchId[rubber.matchId] ?? [];
	}

	let byMatchId = $derived(progressionQuery.current?.byMatchId ?? {});
	let expandedRubberId = $state<string | null>(null);
	let selectedGameByRubberId = $state<Record<string, string>>({});

	function toggleRubber(rubberId: string) {
		expandedRubberId = expandedRubberId === rubberId ? null : rubberId;
	}

	function availableGameNos(rubber: TieRubber, points: NonNullable<(typeof byMatchId)[string]>) {
		const fromPoints = getScoreProgressionGameNos(points);
		const fromDetails = rubber.gameDetails.map((detail) => detail.gameNo);
		return [...new Set([...fromDetails, ...fromPoints])].sort((a, b) => a - b);
	}

	function selectedGameNo(rubber: TieRubber, points: NonNullable<(typeof byMatchId)[string]>) {
		const gameNos = availableGameNos(rubber, points);
		if (gameNos.length === 0) return null;
		const selected = Number(selectedGameByRubberId[rubber.id]);
		return gameNos.includes(selected) ? selected : gameNos[gameNos.length - 1];
	}

	function selectGame(rubberId: string, value: string) {
		selectedGameByRubberId = { ...selectedGameByRubberId, [rubberId]: value };
	}

	function scoreForGame(
		rubber: TieRubber,
		points: NonNullable<(typeof byMatchId)[string]>,
		gameNo: number | null
	) {
		const gamePoints = filterScorePointsByGame(points, gameNo);
		const lastPoint = gamePoints[gamePoints.length - 1];
		if (lastPoint) return lastPoint;
		if (gameNo == null) return null;
		const detail = rubber.gameDetails.find((game) => game.gameNo === gameNo);
		return detail ? { scoreA: detail.scoreA, scoreB: detail.scoreB } : null;
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
							: 'font-bold text-muted-emphasis'
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
							: 'text-muted'
					)}
				>
					{g.scoreA}–{g.scoreB}
				</p>
			{/each}
		</div>
	{:else}
		<span class="text-center text-xs text-muted">{rubberStatusLabel(rubber.status)}</span>
	{/if}
{/snippet}

{#if query.current == null}
	<section class="space-y-3">
		<div class="h-3 w-16 animate-pulse rounded-full bg-zinc-200"></div>
		<div class="grid gap-4 md:grid-cols-2">
			{#each [0, 1] as i (i)}
				<div class="animate-pulse overflow-hidden rounded-2xl border border-border-subtle bg-white">
					<div class="space-y-2 px-5 pt-4 pb-3">
						<div class="h-2.5 w-24 rounded-full bg-zinc-200"></div>
						<div class="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
							<div class="h-5 w-20 rounded-full bg-zinc-200"></div>
							<div class="h-8 w-14 rounded-lg bg-zinc-200"></div>
							<div class="ml-auto h-5 w-20 rounded-full bg-zinc-200"></div>
						</div>
					</div>
					<div class="space-y-2.5 border-t border-border-subtle px-5 py-3">
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
		<SectionLabel>進行中</SectionLabel>
		<div class="grid gap-4 md:grid-cols-2">
			{#each ties as tie (tie.id)}
				{@const tieRubbers = rubbersByTieId[tie.id] ?? []}
				{@const hasPlayingRubber = tieRubbers.some((r: TieRubber) => r.status === 'playing')}
				<Card class={cn('overflow-hidden', hasPlayingRubber ? 'border-emerald-200' : '')} flush>
					<div class="px-5 pt-4 pb-3">
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0">
								<p class="text-xs font-medium text-muted">
									{phaseLabel(tie.phase)} · {tie.tieCode}
								</p>
								<p class="mt-0.5 text-[11px] text-muted">
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
						<div class="border-t border-border-subtle">
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
										<span class="text-muted">—</span>
									{/if}
								{/snippet}
								<button
									type="button"
									class="flex w-full items-center gap-x-2 border-b border-zinc-50 px-4 py-2 text-left text-xs transition-colors hover:bg-zinc-50 {isPlaying
										? 'bg-emerald-50/50'
										: ''}"
									onclick={() => toggleRubber(rubber.id)}
								>
									<span class="w-10 shrink-0 font-medium text-muted"
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
									{@const gameNos = availableGameNos(rubber, points)}
									{@const gameNo = selectedGameNo(rubber, points)}
									{@const chartPoints = filterScorePointsByGame(points, gameNo)}
									{@const currentScore = scoreForGame(rubber, points, gameNo)}
									<div
										class="grid transition-all duration-200 ease-out data-[state=closed]:grid-rows-[0fr] data-[state=open]:grid-rows-[1fr]"
										data-state={isExpanded ? 'open' : 'closed'}
									>
										<div class="overflow-hidden">
											<div class="border-b border-border-subtle bg-zinc-50 px-5 py-3">
												<div class="mb-2 flex items-end justify-between gap-3">
													<span class="text-xs font-semibold tracking-wide text-muted">
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
												{#if gameNos.length > 1}
													<AppTabs
														value={String(gameNo)}
														items={gameNos.map((n) => ({
															value: String(n),
															label: `第${n}ゲーム`
														}))}
														onValueChange={(value) => selectGame(rubber.id, value)}
														listClass="mb-3"
													/>
												{/if}
												{#if chartPoints.length > 0}
													<ScoreProgressChart
														points={chartPoints}
														nameA={tie.teamAName ?? 'A'}
														nameB={tie.teamBName ?? 'B'}
													/>
												{:else}
													<p class="py-4 text-center text-xs text-muted">
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
