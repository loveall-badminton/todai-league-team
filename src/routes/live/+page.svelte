<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { phaseLabel, rubberLabel, rubberStatusLabel, tieStatusLabel } from '$lib/domain/tokyoLeagueLabels';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const activeTies = $derived(data.ties.filter((t) => t.status === 'playing'));
	const otherTies = $derived(data.ties.filter((t) => t.status !== 'playing'));

	let lastUpdated = $state(new Date());

	$effect(() => {
		const interval = setInterval(async () => {
			await invalidateAll();
			lastUpdated = new Date();
		}, 8000);
		return () => clearInterval(interval);
	});

	function formatTime(d: Date) {
		return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}
</script>

<svelte:head>
	<title>ライブ | 東大リーグ団体戦</title>
</svelte:head>

<main class="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-950 sm:px-6">
	<div class="mx-auto max-w-5xl space-y-8">

		<!-- Header -->
		<header class="flex flex-wrap items-center justify-between gap-3">
			<h1 class="text-2xl font-semibold tracking-tight">
				{data.settings?.eventName ?? '東大リーグ団体戦'}
			</h1>
			<div class="flex items-center gap-2 text-xs text-zinc-400">
				<span class="flex items-center gap-1.5">
					<span class="relative flex size-2">
						{#if activeTies.length > 0}
							<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
						{/if}
						<span class="relative inline-flex size-2 rounded-full {activeTies.length > 0 ? 'bg-emerald-500' : 'bg-zinc-300'}"></span>
					</span>
					{activeTies.length > 0 ? `${activeTies.length}試合進行中` : '進行中の試合なし'}
				</span>
				<span class="text-zinc-300">·</span>
				<span>{formatTime(lastUpdated)} 更新</span>
			</div>
		</header>

		<!-- Active ties -->
		{#if activeTies.length > 0}
			<section class="space-y-4">
				<h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-400">進行中</h2>
				<div class="grid gap-4 md:grid-cols-2">
					{#each activeTies as tie (tie.id)}
						{@const tieRubbers = data.publicRubbersByTieId[tie.id] ?? []}
						<div class="rounded-2xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
							<!-- Tie header: team names + rubber count score -->
							<div class="px-5 pt-4 pb-3">
								<p class="text-xs font-medium text-zinc-400">{phaseLabel(tie.phase)} · {tie.tieCode}</p>
								<div class="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
									<p class="min-w-0 truncate font-semibold">{tie.teamAName ?? '未定'}</p>
									<div class="text-center">
										<p class="text-3xl font-bold tabular-nums leading-none text-emerald-700">
											{tie.teamScoreA}<span class="mx-1 text-emerald-300">–</span>{tie.teamScoreB}
										</p>
										<p class="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-zinc-400">種目</p>
									</div>
									<p class="min-w-0 truncate text-right font-semibold">{tie.teamBName ?? '未定'}</p>
								</div>
							</div>

							<!-- Rubber rows with column headers -->
							{#if tieRubbers.length > 0}
								<div class="border-t border-zinc-100">
									<!-- Column headers -->
									<div class="grid grid-cols-[4rem_1fr_5rem_1fr] items-center gap-x-2 px-4 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-300">
										<span></span>
										<span class="truncate">{tie.teamAName ?? '未定'}</span>
										<span class="text-center">ゲームスコア</span>
										<span class="truncate text-right">{tie.teamBName ?? '未定'}</span>
									</div>
									{#each tieRubbers as rubber (rubber.id)}
										{@const isPlaying = rubber.status === 'playing'}
										<div class="grid grid-cols-[4rem_1fr_auto_1fr] items-center gap-x-2 border-t border-zinc-50 px-4 py-2 text-xs
											{isPlaying ? 'bg-emerald-50' : ''}">
											<span class="font-medium text-zinc-400">{rubberLabel(rubber.code)}</span>
											<span class="truncate text-zinc-700">{rubber.sideAPlayers ?? '—'}</span>
											<div class="shrink-0 text-center">
												{#if rubber.gamesScore !== null}
													<p class="font-bold tabular-nums {isPlaying ? 'text-emerald-700' : 'text-zinc-600'}">{rubber.gamesScore}</p>
													{#each rubber.gameDetails as g (g.gameNo)}
														<p class="text-[10px] tabular-nums {isPlaying && g.gameNo === rubber.gameDetails.length ? 'text-emerald-500 font-medium' : 'text-zinc-400'}">
															{g.scoreA}–{g.scoreB}
														</p>
													{/each}
												{:else}
													<span class="text-zinc-400">{rubberStatusLabel(rubber.status)}</span>
												{/if}
											</div>
											<span class="truncate text-right text-zinc-700">{rubber.sideBPlayers ?? '—'}</span>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Standings -->
		<section class="grid gap-4 md:grid-cols-2">
			{#each [{ label: 'Aリーグ', rows: data.standingA }, { label: 'Bリーグ', rows: data.standingB }] as group (group.label)}
				<div class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
					<h2 class="mb-3 text-sm font-semibold text-zinc-700">{group.label}順位</h2>
					{#if group.rows.length === 0}
						<p class="text-sm text-zinc-400">集計中...</p>
					{:else}
						<div class="divide-y divide-zinc-100">
							{#each group.rows as row (row.teamId)}
								<div class="flex items-center gap-3 py-2 text-sm">
									<span class="w-5 shrink-0 text-right font-bold tabular-nums text-zinc-300">
										{row.rank ?? '—'}
									</span>
									<span class="flex-1 truncate font-medium">{row.teamName}</span>
									<span class="shrink-0 tabular-nums text-zinc-500">
										{row.teamMatchesWon}勝{row.teamMatchesLost}敗
									</span>
									<span class="shrink-0 tabular-nums text-xs text-zinc-400">
										{row.rubbersWon}–{row.rubbersLost}
									</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</section>

		<!-- Finals bracket -->
		{#if data.finalsBoard.length > 0}
			<section class="space-y-3">
				<h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-400">決勝トーナメント</h2>
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each data.finalsBoard as tie (tie.id)}
						<div class="rounded-2xl border {tie.status === 'playing' ? 'border-emerald-200' : 'border-zinc-200'} bg-white p-4 shadow-sm">
							<p class="text-xs font-medium text-zinc-400">{phaseLabel(tie.phase)}</p>
							<div class="mt-1.5 flex items-baseline justify-between gap-2">
								<p class="min-w-0 truncate text-sm font-semibold">
									{tie.teamAName ?? '未定'} vs {tie.teamBName ?? '未定'}
								</p>
								<span class="shrink-0 text-lg font-bold tabular-nums {tie.status === 'playing' ? 'text-emerald-700' : ''}">
									{tie.teamScoreA}–{tie.teamScoreB}
								</span>
							</div>
							<p class="mt-0.5 text-xs text-zinc-400">{tieStatusLabel(tie.status)}</p>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- All other ties (collapsible by phase) -->
		{#if otherTies.length > 0}
			<section class="space-y-3">
				<h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-400">全対戦</h2>
				<div class="space-y-1.5">
					{#each otherTies as tie (tie.id)}
						{@const rubbers = data.publicRubbersByTieId[tie.id] ?? []}
						<div class="rounded-xl border border-zinc-200 bg-white overflow-hidden">
							<div class="flex items-center gap-3 px-4 py-3">
								<div class="min-w-0 flex-1">
									<p class="text-xs text-zinc-400">{phaseLabel(tie.phase)} · {tie.tieCode}</p>
									<p class="truncate text-sm font-medium">
										{tie.teamAName ?? '未定'} <span class="text-zinc-400">vs</span> {tie.teamBName ?? '未定'}
									</p>
								</div>
								<div class="shrink-0 text-right">
									<p class="text-lg font-bold tabular-nums">{tie.teamScoreA}–{tie.teamScoreB}</p>
									<p class="text-xs text-zinc-400">{tieStatusLabel(tie.status)}</p>
								</div>
							</div>
							{#if rubbers.length > 0 && (tie.status === 'finished' || tie.status === 'confirmed')}
								<div class="border-t border-zinc-100">
									{#each rubbers as rubber (rubber.id)}
										<div class="grid grid-cols-[4rem_1fr_auto_1fr] items-center gap-x-2 border-t border-zinc-50 px-4 py-1.5 text-xs">
											<span class="font-medium text-zinc-400">{rubberLabel(rubber.code)}</span>
											<span class="truncate text-zinc-600">{rubber.sideAPlayers ?? '—'}</span>
											<span class="shrink-0 px-1 text-center font-medium text-zinc-500">
												{rubber.gamesScore ?? rubberStatusLabel(rubber.status)}
											</span>
											<span class="truncate text-right text-zinc-600">{rubber.sideBPlayers ?? '—'}</span>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/if}

		{#if data.ties.length === 0}
			<div class="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
				<p class="text-sm text-zinc-400">公開されている対戦はまだありません。</p>
			</div>
		{/if}

	</div>
</main>
