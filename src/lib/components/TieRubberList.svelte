<script lang="ts">
	import type { Snippet } from 'svelte';
	import { rubberLabel, rubberStatusLabel } from '$lib/domain/tokyoLeagueLabels';
	import { cn } from '$lib/utils/cn';

	export type RubberRow = {
		id: string;
		code: string;
		status: string;
		matchStatus?: string | null;
		winnerSide: 'A' | 'B' | null;
		playersA: string[];
		playersB: string[];
		loserLabel: string | null;
		gamesScore: string | null;
		gameDetails: { gameNo: number; scoreA: number; scoreB: number }[];
		matchId?: string | null;
	};

	let {
		rubbers,
		teamAName,
		teamBName,
		variant = 'compact',
		extraHead,
		extraCell
	}: {
		rubbers: RubberRow[];
		teamAName: string;
		teamBName: string;
		variant?: 'compact' | 'table';
		extraHead?: Snippet;
		extraCell?: Snippet<[RubberRow]>;
	} = $props();
</script>

{#snippet playerNames(names: string[], side: 'A' | 'B', rubber: RubberRow)}
	{@const isWinner = rubber.winnerSide === side}
	{@const isLoser = !!rubber.winnerSide && !isWinner}
	{#if names.length > 0}
		<div class="space-y-0.5">
			{#each names as name, i (name + i)}
				<div class={cn(isWinner ? 'font-semibold text-zinc-950' : 'text-zinc-700')}>
					{name}
				</div>
			{/each}
			{#if isLoser && rubber.loserLabel}
				<p class="text-[10px] text-zinc-400">{rubber.loserLabel}</p>
			{/if}
		</div>
	{:else}
		<span class="text-zinc-400">—</span>
	{/if}
{/snippet}

{#snippet scoreCell(rubber: RubberRow)}
	{@const isPlaying = rubber.status === 'playing'}
	{#if rubber.gamesScore !== null}
		<p
			class={cn(
				'tabular-nums',
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
					'tabular-nums',
					isPlaying && g.gameNo === rubber.gameDetails.length
						? 'font-medium text-emerald-500'
						: 'text-zinc-400',
					variant === 'compact' ? 'text-[10px]' : 'text-[11px]'
				)}
			>
				{g.scoreA}–{g.scoreB}
			</p>
		{/each}
	{:else if variant === 'compact'}
		<span class="text-zinc-400">{rubberStatusLabel(rubber.status)}</span>
	{:else}
		<span class="text-zinc-300">—</span>
	{/if}
{/snippet}

{#if variant === 'compact'}
	<!-- Compact grid layout (live page card style) -->
	<div class="overflow-x-auto">
		<div class="min-w-[22rem]">
			<div
				class="grid grid-cols-[4rem_1fr_5rem_1fr] items-center gap-x-2 px-4 py-1 text-[10px] font-medium tracking-wider text-zinc-300"
			>
				<span></span>
				<span class="truncate">{teamAName}</span>
				<span class="text-center">スコア</span>
				<span class="truncate text-right">{teamBName}</span>
			</div>
			{#each rubbers as rubber (rubber.id)}
				{@const isPlaying = rubber.status === 'playing'}
				<div
					class="grid grid-cols-[4rem_1fr_auto_1fr] items-center gap-x-2 border-t border-zinc-50 px-4 py-2 text-xs {isPlaying
						? 'bg-emerald-50'
						: ''}"
				>
					<span class="font-medium text-zinc-400">{rubberLabel(rubber.code)}</span>
					<div class="min-w-0">{@render playerNames(rubber.playersA, 'A', rubber)}</div>
					<div class="shrink-0 text-center">{@render scoreCell(rubber)}</div>
					<div class="min-w-0 text-right">{@render playerNames(rubber.playersB, 'B', rubber)}</div>
				</div>
			{/each}
		</div>
	</div>
{:else}
	<!-- Full table layout (tie detail style) -->
	<div class="overflow-x-auto">
		<table class="w-full min-w-150 text-sm">
			<thead>
				<tr class="border-b border-zinc-100">
					<th class="w-32 px-4 py-3 text-left text-xs font-medium text-zinc-400">種目</th>
					<th class="px-4 py-3 text-left text-xs font-medium text-zinc-400">{teamAName}</th>
					<th class="w-24 px-4 py-3 text-center text-xs font-medium text-zinc-400">スコア</th>
					<th class="px-4 py-3 text-left text-xs font-medium text-zinc-400">{teamBName}</th>
					{@render extraHead?.()}
				</tr>
			</thead>
			<tbody>
				{#each rubbers as rubber (rubber.id)}
					{@const isPlaying = rubber.status === 'playing'}
					<tr class="border-b border-zinc-100 last:border-0 {isPlaying ? 'bg-emerald-50' : ''}">
						<td class="px-4 py-3 font-medium">{rubberLabel(rubber.code)}</td>
						<td class="px-4 py-3 text-sm">{@render playerNames(rubber.playersA, 'A', rubber)}</td>
						<td class="px-4 py-3 text-center">{@render scoreCell(rubber)}</td>
						<td class="px-4 py-3 text-sm">{@render playerNames(rubber.playersB, 'B', rubber)}</td>
						{@render extraCell?.(rubber)}
					</tr>
				{:else}
					<tr>
						<td colspan="99" class="px-4 py-6 text-center text-sm text-zinc-400">
							種目が作成されていません
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
