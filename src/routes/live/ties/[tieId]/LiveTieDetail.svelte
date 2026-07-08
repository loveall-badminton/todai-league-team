<script lang="ts">
	import { slide } from 'svelte/transition';
	import type { TiePageData } from '$lib/server/services/liveBoardService';
	import type { ProgressionRealtimeState } from '../../progressionRealtime';
	import {
		courtDisplayLabel,
		phaseLabel,
		rubberLabel,
		rubberStatusLabel
	} from '$lib/domain/tokyoLeagueLabels';
	import AppTabs from '$lib/components/AppTabs.svelte';
	import Card from '$lib/components/Card.svelte';
	import IconMeta from '$lib/components/IconMeta.svelte';
	import { ChevronDown, MapPin } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import { filterScorePointsByGame, getScoreProgressionGameNos } from '$lib/utils/scoreProgression';

	type TieRubber = TiePageData['rubbers'][number];

	interface Props {
		tie: TiePageData['tie'];
		rubbers: TieRubber[];
		progressionQuery: { current: ProgressionRealtimeState | null };
		expandedRubberId?: string | null;
		onExpand?: () => void;
	}

	let {
		tie,
		rubbers,
		progressionQuery,
		expandedRubberId = $bindable(null),
		onExpand
	}: Props = $props();

	let byMatchId = $derived(progressionQuery.current?.byMatchId ?? {});
	let selectedGameByRubberId: Record<string, string> = $state({});

	// Cache module import so {#await} resolves instantly after first expansion
	let chartModulePromise: Promise<typeof import('../../ScoreProgressChart.svelte')> | null = null;
	function getChartModule() {
		chartModulePromise ??= import('../../ScoreProgressChart.svelte');
		return chartModulePromise;
	}

	function toggleRubber(rubberId: string) {
		const willExpand = expandedRubberId !== rubberId;
		expandedRubberId = expandedRubberId === rubberId ? null : rubberId;
		if (willExpand) onExpand?.();
	}

	function selectGame(rubberId: string, value: string) {
		selectedGameByRubberId = { ...selectedGameByRubberId, [rubberId]: value };
	}

	function progressionPoints(rubber: TieRubber) {
		if (!rubber.matchId) return [];
		return byMatchId[rubber.matchId] ?? [];
	}

	function availableGameNos(rubber: TieRubber) {
		const points = progressionPoints(rubber);
		const fromPoints = getScoreProgressionGameNos(points);
		const fromDetails = rubber.gameDetails.map((d) => d.gameNo);
		return [...new Set([...fromDetails, ...fromPoints])].sort((a, b) => a - b);
	}

	function selectedGameNo(rubber: TieRubber) {
		const gameNos = availableGameNos(rubber);
		if (gameNos.length === 0) return null;
		const selected = Number(selectedGameByRubberId[rubber.id]);
		return gameNos.includes(selected) ? selected : gameNos[gameNos.length - 1];
	}

	function scoreForGame(rubber: TieRubber, gameNo: number | null) {
		const points = progressionPoints(rubber);
		const gamePoints = filterScorePointsByGame(points, gameNo);
		const lastPoint = gamePoints[gamePoints.length - 1];
		if (lastPoint) return lastPoint;
		if (gameNo == null) return null;
		const detail = rubber.gameDetails.find((g) => g.gameNo === gameNo);
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
					<span class={g.winnerSide === 'A' ? 'font-bold' : ''}>{g.scoreA}</span>
					–
					<span class={g.winnerSide === 'B' ? 'font-bold' : ''}>{g.scoreB}</span>
				</p>
			{/each}
		</div>
	{:else}
		<span class="text-center text-xs text-muted">{rubberStatusLabel(rubber.status)}</span>
	{/if}
{/snippet}

{#snippet playerNames(ids: string, side: 'A' | 'B', winnerSide: string | null | undefined)}
	{@const names = ids.split(' / ').filter(Boolean)}
	{@const isWinner = winnerSide === side}
	{#if names.length > 0}
		<div class="min-w-0 space-y-0.5">
			{#each names as name, i (name + i)}
				<div class={cn('truncate', side === 'A' ? '' : 'text-right', isWinner && 'font-bold')}>
					{name}
				</div>
			{/each}
		</div>
	{:else}
		<span class="text-muted">—</span>
	{/if}
{/snippet}

<!-- Tie header -->
<Card class="mb-4" flush>
	<div class="px-5 pt-4 pb-3">
		<p class="text-xs font-medium text-muted">
			{phaseLabel(tie.phase)} · {tie.tieCode}
		</p>
		<IconMeta
			Icon={MapPin}
			label="コート"
			value={courtDisplayLabel(tie.venue, tie.courtBlockCode)}
			class="mt-0.5 text-[11px] text-muted"
			iconClass="size-3 shrink-0"
		/>
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
</Card>

<!-- Rubber list -->
<Card class="overflow-hidden" flush>
	{#each rubbers as rubber (rubber.id)}
		{@const isPlaying = rubber.status === 'playing'}
		{@const isExpanded = expandedRubberId === rubber.id}
		<button
			type="button"
			class="flex w-full items-center gap-x-2 border-b border-zinc-50 px-4 py-2.5 text-left text-xs transition-colors hover:bg-zinc-50 {isPlaying
				? 'bg-emerald-50/50'
				: ''}"
			onclick={() => toggleRubber(rubber.id)}
		>
			<span class="w-20 shrink-0 truncate font-medium text-muted-foreground"
				>{rubberLabel(rubber.code)}</span
			>
			<div class="min-w-0 flex-1">
				{@render playerNames(rubber.sideAPlayers ?? '', 'A', rubber.winnerSide)}
			</div>
			<div class="shrink-0">{@render rubberScore(rubber)}</div>
			<div class="min-w-0 flex-1">
				{@render playerNames(rubber.sideBPlayers ?? '', 'B', rubber.winnerSide)}
			</div>
			<ChevronDown
				class={cn(
					'ml-1 size-3.5 shrink-0 text-zinc-300 transition-transform',
					isExpanded && 'rotate-180'
				)}
			/>
		</button>
		{#if isExpanded}
			{@const gameNos = availableGameNos(rubber)}
			{@const gameNo = selectedGameNo(rubber)}
			{@const points = progressionPoints(rubber)}
			{@const chartPoints = filterScorePointsByGame(points, gameNo)}
			{@const currentScore = scoreForGame(rubber, gameNo)}
			{@const hasProgression = progressionQuery.current !== null}
			<div
				transition:slide={{ duration: 200 }}
				class="border-b border-border-subtle bg-zinc-50 px-5 py-3"
			>
				<div class="mb-2 flex items-end justify-between gap-3">
					<span class="text-xs font-semibold tracking-wide text-muted">スコア推移</span>
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
						items={gameNos.map((n) => ({ value: String(n), label: `第${n}ゲーム` }))}
						onValueChange={(value) => selectGame(rubber.id, value)}
						listClass="mb-3"
					/>
				{/if}
				{#if !hasProgression}
					<div class="h-32 animate-pulse rounded bg-zinc-100"></div>
				{:else if chartPoints.length > 0}
					{#await getChartModule()}
						<div class="h-32 animate-pulse rounded bg-zinc-100"></div>
					{:then { default: ScoreProgressChart }}
						<ScoreProgressChart
							points={chartPoints}
							nameA={tie.teamAName ?? 'A'}
							nameB={tie.teamBName ?? 'B'}
						/>
					{/await}
				{:else}
					<p class="py-4 text-center text-xs text-muted">スコアデータがありません</p>
				{/if}
			</div>
		{/if}
	{/each}
</Card>
