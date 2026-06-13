<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { onMount } from 'svelte';
	import {
		courtDisplayLabel,
		phaseLabel,
		rubberLabel,
		rubberStatusLabel,
		tieStatusLabel
	} from '$lib/domain/tokyoLeagueLabels';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let activeTies = $derived(data.ties.filter((t) => t.status === 'playing'));

	let lastUpdated = $state(new Date());

	onMount(() => {
		const interval = setInterval(async () => {
			await invalidateAll();
			lastUpdated = new Date();
		}, 8000);
		return () => clearInterval(interval);
	});

	function formatTime(d: Date) {
		return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}

	let standings = $derived([
		{ code: 'A', label: 'Aリーグ', rows: data.standingA, ties: data.groupA },
		{ code: 'B', label: 'Bリーグ', rows: data.standingB, ties: data.groupB }
	]);

	function groupTeams(group: (typeof standings)[number]) {
		return group.rows
			.map((row) => data.teams.find((team) => team.id === row.teamId))
			.filter((team) => team != null);
	}

	function tieForPair(group: (typeof standings)[number], rowTeamId: string, colTeamId: string) {
		return group.ties.find(
			(tie) =>
				(tie.teamAId === rowTeamId && tie.teamBId === colTeamId) ||
				(tie.teamAId === colTeamId && tie.teamBId === rowTeamId)
		);
	}

	function cellInfo(group: (typeof standings)[number], rowTeamId: string, colTeamId: string) {
		const tie = tieForPair(group, rowTeamId, colTeamId);
		if (!tie) return null;
		const myScore = tie.teamAId === rowTeamId ? tie.teamScoreA : tie.teamScoreB;
		const theirScore = tie.teamAId === rowTeamId ? tie.teamScoreB : tie.teamScoreA;
		const won = tie.winnerTeamId === rowTeamId || (!!tie.winnerTeamId && myScore > theirScore);
		const lost = !!tie.winnerTeamId && tie.winnerTeamId !== rowTeamId;
		const done = tie.status === 'finished' || tie.status === 'confirmed' || !!tie.winnerTeamId;
		return { tie, myScore, theirScore, won, lost, done };
	}

	function loserStatusLabel(status: string) {
		if (status === 'forfeited') return '棄権';
		if (status === 'retired') return 'リタイア';
		return null;
	}

	function splitPlayerNames(value: string | null | undefined) {
		return value ? value.split(' / ').filter(Boolean) : [];
	}
</script>

<svelte:head>
	<title>ライブ | 東大リーグ団体戦</title>
</svelte:head>

{#snippet headerActions()}
	<div class="flex items-center gap-2 text-xs text-zinc-400">
		<span class="flex items-center gap-1.5">
			<span class="relative flex size-2">
				{#if activeTies.length > 0}
					<span
						class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
					></span>
				{/if}
				<span
					class="relative inline-flex size-2 rounded-full {activeTies.length > 0
						? 'bg-emerald-500'
						: 'bg-zinc-300'}"
				></span>
			</span>
			{activeTies.length > 0 ? `${activeTies.length}試合進行中` : '進行中の試合なし'}
		</span>
		<span class="text-zinc-200">·</span>
		<span>{formatTime(lastUpdated)} 更新</span>
	</div>
{/snippet}

<PageHeader title="ライブ表示" actions={headerActions} />

<!-- Active ties -->
{#if activeTies.length > 0}
	<section class="space-y-3">
		<h2 class="text-xs font-semibold tracking-wider text-zinc-400">進行中</h2>
		<div class="grid gap-4 md:grid-cols-2">
			{#each activeTies as tie (tie.id)}
				{@const tieRubbers = data.publicRubbersByTieId[tie.id] ?? []}
				<div class="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
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
							<div
								class="grid grid-cols-[4rem_1fr_5rem_1fr] items-center gap-x-2 px-4 py-1 text-[10px] font-medium tracking-wider text-zinc-300"
							>
								<span></span>
								<span class="truncate">{tie.teamAName ?? ''}</span>
								<span class="text-center">スコア</span>
								<span class="truncate text-right">{tie.teamBName ?? ''}</span>
							</div>
							{#each tieRubbers as rubber (rubber.id)}
								{@const isPlaying = rubber.status === 'playing'}
								{@const loserLabel = loserStatusLabel(rubber.matchStatus ?? rubber.status)}
								{@const sideANames = splitPlayerNames(rubber.sideAPlayers)}
								{@const sideBNames = splitPlayerNames(rubber.sideBPlayers)}
								<div
									class="grid grid-cols-[4rem_1fr_auto_1fr] items-center gap-x-2 border-t border-zinc-50 px-4 py-2 text-xs {isPlaying
										? 'bg-emerald-50'
										: ''}"
								>
									<span class="font-medium text-zinc-400">{rubberLabel(rubber.code)}</span>
									<div class="min-w-0">
										{#if sideANames.length > 0}
											<div class="space-y-0.5">
												{#each sideANames as name, index (name + index)}
													<div class={rubber.winnerSide === 'A' ? 'font-semibold text-zinc-950' : 'text-zinc-700'}>
														<span class="block">{name}</span>
														{#if loserLabel && rubber.winnerSide !== 'A'}
															<span class="mt-0.5 block text-[10px] text-zinc-400">{loserLabel}</span>
														{/if}
													</div>
												{/each}
											</div>
										{:else}
											<span class="text-zinc-700">—</span>
										{/if}
									</div>
									<div class="shrink-0 text-center">
										{#if rubber.gamesScore !== null}
											<p
												class="tabular-nums {rubber.winnerSide
													? 'font-extrabold text-emerald-700'
													: isPlaying
														? 'font-bold text-emerald-700'
														: 'font-bold text-zinc-600'}"
											>
												{rubber.gamesScore}
											</p>
											{#each rubber.gameDetails as g (g.gameNo)}
												<p
													class="text-[10px] tabular-nums {isPlaying &&
													g.gameNo === rubber.gameDetails.length
														? 'font-medium text-emerald-500'
														: 'text-zinc-400'}"
												>
													{g.scoreA}–{g.scoreB}
												</p>
											{/each}
										{:else}
											<span class="text-zinc-400">{rubberStatusLabel(rubber.status)}</span>
										{/if}
									</div>
									<div class="min-w-0 text-right">
										{#if sideBNames.length > 0}
											<div class="space-y-0.5">
												{#each sideBNames as name, index (name + index)}
													<div class={rubber.winnerSide === 'B' ? 'font-semibold text-zinc-950' : 'text-zinc-700'}>
														<span class="block">{name}</span>
														{#if loserLabel && rubber.winnerSide !== 'B'}
															<span class="mt-0.5 block text-right text-[10px] text-zinc-400">
																{loserLabel}
															</span>
														{/if}
													</div>
												{/each}
											</div>
										{:else}
											<span class="text-zinc-700">—</span>
										{/if}
									</div>
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
{#if standings.some((g) => g.rows.length > 0)}
	<section class="space-y-3">
		<h2 class="text-xs font-semibold tracking-wider text-zinc-400">順位表</h2>
		<div class="grid gap-4 xl:grid-cols-2">
			{#each standings as group (group.label)}
				{@const teams = groupTeams(group)}
				<div class="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
					<div class="border-b border-zinc-100 px-4 py-3">
						<h3 class="text-sm font-semibold text-zinc-950">{group.label}</h3>
					</div>
					{#if group.rows.length === 0}
						<p class="px-4 py-6 text-sm text-zinc-400">集計中...</p>
					{:else}
						<div class="overflow-x-auto">
							<table class="w-full min-w-180 text-sm">
								<thead>
									<tr class="border-b border-zinc-100">
										<th class="w-10 px-4 py-2 text-left text-xs font-medium text-zinc-400">順位</th>
										<th class="min-w-28 px-4 py-2 text-left text-xs font-medium text-zinc-400">
											チーム
										</th>
										{#each teams as team (team.id)}
											<th class="min-w-18 px-2 py-2 text-center text-xs font-medium text-zinc-400">
												{team.name}
											</th>
										{/each}
										<th class="w-16 px-2 py-2 text-center text-xs font-medium text-zinc-400"
											>団体</th
										>
										<th class="w-16 px-2 py-2 text-center text-xs font-medium text-zinc-400"
											>種目</th
										>
										<th class="w-16 px-2 py-2 text-center text-xs font-medium text-zinc-400"
											>ゲーム</th
										>
									</tr>
								</thead>
								<tbody>
									{#each group.rows as row (row.teamId)}
										<tr
											class="border-b border-zinc-50 last:border-0 {row.requiresTiebreaker
												? 'bg-amber-50'
												: ''}"
										>
											<td
												class="px-4 py-2.5 text-center text-sm font-bold text-zinc-400 tabular-nums"
											>
												{row.rank ?? '—'}
											</td>
											<td class="px-4 py-2.5 font-medium text-zinc-950">{row.teamName}</td>
											{#each teams as team (team.id)}
												<td class="px-2 py-2.5 text-center">
													{#if row.teamId === team.id}
														<span class="text-zinc-200">—</span>
													{:else}
														{@const cell = cellInfo(group, row.teamId, team.id)}
														{#if cell?.done}
															<span
																class="inline-flex min-w-12 justify-center rounded-lg px-2 py-0.5 text-xs font-semibold tabular-nums
																		{cell.won
																	? 'bg-emerald-50 text-emerald-700'
																	: cell.lost
																		? 'bg-rose-50 text-rose-700'
																		: 'bg-zinc-100 text-zinc-600'}"
															>
																{cell.myScore}-{cell.theirScore}
															</span>
														{:else if cell}
															<span
																class="inline-flex min-w-12 items-center justify-center rounded-lg px-2 py-0.5 text-xs
																			{cell.tie.status === 'playing'
																	? 'border border-emerald-200 bg-emerald-50 font-semibold text-emerald-700 shadow-sm'
																	: 'bg-zinc-50 text-zinc-400'}"
															>
																{cell.tie.status === 'playing' ? '進行中' : '予定'}
															</span>
														{:else}
															<span class="text-xs text-zinc-300">-</span>
														{/if}
													{/if}
												</td>
											{/each}
											<td class="px-2 py-2.5 text-center text-zinc-700 tabular-nums">
												{row.teamMatchesWon}-{row.teamMatchesLost}
											</td>
											<td class="px-2 py-2.5 text-center text-zinc-700 tabular-nums">
												{row.rubbersWon}-{row.rubbersLost}
											</td>
											<td class="px-2 py-2.5 text-center text-zinc-400 tabular-nums">
												{row.gamesWon}-{row.gamesLost}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</section>
{/if}

<!-- Finals bracket -->
{#if data.finalsBoard.length > 0}
	<section class="space-y-3">
		<h2 class="text-xs font-semibold tracking-wider text-zinc-400">決勝トーナメント</h2>
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.finalsBoard as tie (tie.id)}
				<div
					class="rounded-2xl border {tie.status === 'playing'
						? 'border-emerald-200'
						: 'border-zinc-200'} bg-white p-4 shadow-sm"
				>
					<p class="text-xs font-medium text-zinc-400">{phaseLabel(tie.phase)}</p>
					<div class="mt-1.5 flex items-baseline justify-between gap-2">
						<p class="min-w-0 truncate text-sm font-semibold">
							{tie.teamAName ?? '未定'} vs {tie.teamBName ?? '未定'}
						</p>
						<span
							class="shrink-0 text-lg font-bold tabular-nums {tie.status === 'playing'
								? 'text-emerald-700'
								: ''}"
						>
							{tie.teamScoreA}–{tie.teamScoreB}
						</span>
					</div>
					<p class="mt-0.5 text-xs text-zinc-400">{tieStatusLabel(tie.status)}</p>
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
