<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import Card from '$lib/components/Card.svelte';
	import type { RubberRow } from '$lib/components/TieRubberList.svelte';
	import TieRubberList from '$lib/components/TieRubberList.svelte';
	import { courtDisplayLabel, phaseLabel, rubberLabel } from '$lib/domain/tokyoLeagueLabels';
	import type { PublicRubberSummary } from '$lib/server/services/liveBoardService';
	import type { LivePageData } from '$lib/server/services/livePageService';
	import { ChartLine } from '@lucide/svelte';
	import { Dialog } from 'bits-ui';
	import ScoreProgressChart from './ScoreProgressChart.svelte';

	type ActiveTie = NonNullable<LivePageData['activeTies']>['ties'][number];
	type PlayingRubber = NonNullable<LivePageData['activeTies']>['rubbersByTieId'][string][number];
	type QueryValue<T> = { current: T | null | undefined };

	let {
		query,
		progressionQuery
	}: {
		query: QueryValue<LivePageData['activeTies']>;
		progressionQuery: QueryValue<LivePageData['progression']>;
	} = $props();

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

	function progressionPoints(
		rubber: PublicRubberSummary,
		byMatchId: NonNullable<typeof progressionQuery.current>['byMatchId']
	) {
		if (!rubber.matchId) return [];
		return byMatchId[rubber.matchId] ?? [];
	}

	// Dialog state — one shared dialog, shows chart(s) for the selected tie
	let dialogOpen = $state(false);
	let selectedTieId = $state<string | null>(null);

	let selectedTie = $derived(
		selectedTieId
			? (query.current?.ties.find((t: ActiveTie) => t.id === selectedTieId) ?? null)
			: null
	);
	let selectedPlayingRubbers = $derived(
		selectedTieId
			? (query.current?.rubbersByTieId[selectedTieId] ?? []).filter(
					(r: PlayingRubber) => r.status === 'playing'
				)
			: []
	);
	let byMatchId = $derived(progressionQuery.current?.byMatchId ?? {});

	function openChart(tieId: string) {
		selectedTieId = tieId;
		dialogOpen = true;
	}
</script>

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
				{@const hasPlayingRubber = tieRubbers.some((r: PlayingRubber) => r.status === 'playing')}
				<Card class="overflow-hidden border-emerald-200">
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
							{#if hasPlayingRubber}
								<AppButton variant="secondary" size="sm" onclick={() => openChart(tie.id)}>
									<ChartLine class="size-4" />
									スコア推移
								</AppButton>
							{/if}
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

<!-- Score progression dialog (shared, one per page) -->
<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-white shadow-xl outline-none"
		>
			{#if selectedTie}
				<!-- Fixed header -->
				<div
					class="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-6 pt-6 pb-4"
				>
					<div>
						<Dialog.Title class="text-base font-semibold text-zinc-950">スコア推移</Dialog.Title>
						<p class="mt-0.5 text-sm text-zinc-500">
							{selectedTie.teamAName ?? '未定'} vs {selectedTie.teamBName ?? '未定'}
						</p>
					</div>
					<Dialog.Close
						class="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
					>
						閉じる
					</Dialog.Close>
				</div>
				<!-- Scrollable chart area -->
				<div class="space-y-5 overflow-y-auto px-6 py-5">
					{#each selectedPlayingRubbers as rubber (rubber.id)}
						{@const points = progressionPoints(rubber, byMatchId)}
						<div>
							<p class="mb-2 text-xs font-semibold tracking-wide text-zinc-400">
								{rubberLabel(rubber.code)}
							</p>
							<ScoreProgressChart
								{points}
								nameA={selectedTie.teamAName ?? 'A'}
								nameB={selectedTie.teamBName ?? 'B'}
							/>
						</div>
					{/each}
				</div>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
