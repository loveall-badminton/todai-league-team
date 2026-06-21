<script lang="ts">
	import type { ServiceState, MatchPlayer } from '$lib/domain/types';
	import Card from '$lib/components/Card.svelte';
	import { cn } from '$lib/utils/cn';

	let {
		service,
		sideAIsLeft,
		leftAccent,
		rightAccent,
		leftSidePlayers,
		rightSidePlayers,
		players
	}: {
		service: ServiceState | null | undefined;
		sideAIsLeft: boolean;
		leftAccent: 'pink' | 'cyan';
		rightAccent: 'pink' | 'cyan';
		leftSidePlayers: MatchPlayer[];
		rightSidePlayers: MatchPlayer[];
		players: MatchPlayer[];
	} = $props();

	let leftCA = $derived.by(() => {
		if (service?.discipline !== 'doubles') return null;
		return sideAIsLeft ? service.courtAssignments.A : service.courtAssignments.B;
	});
	let rightCA = $derived.by(() => {
		if (service?.discipline !== 'doubles') return null;
		return sideAIsLeft ? service.courtAssignments.B : service.courtAssignments.A;
	});

	function playerName(id: string | null | undefined): string {
		return players.find((p) => p.id === id)?.name ?? '-';
	}
</script>

{#snippet playerCell(playerId: string, accent: 'pink' | 'cyan', hasBorderBottom: boolean)}
	{@const isServer = service?.serverPlayerId === playerId}
	{@const isReceiver = service?.receiverPlayerId === playerId}
	<div
		class="flex min-h-18 flex-col items-center justify-center gap-0.5 p-3 text-center
		{hasBorderBottom ? 'border-b border-border-subtle' : ''}
		{isServer ? (accent === 'pink' ? 'bg-pink-50' : 'bg-cyan-50') : isReceiver ? 'bg-zinc-50' : ''}"
	>
		{#if isServer}
			<span class={cn('text-xs font-bold', accent === 'pink' ? 'text-pink-600' : 'text-cyan-600')}
				>サーバー</span
			>
		{:else if isReceiver}
			<span class={cn('text-xs font-bold', accent === 'pink' ? 'text-pink-600' : 'text-cyan-600')}
				>レシーバー</span
			>
		{:else}
			<span class="text-xs text-zinc-300">—</span>
		{/if}
		<p class="text-sm leading-tight font-medium text-zinc-800">{playerName(playerId)}</p>
	</div>
{/snippet}

{#if service}
	<Card>
		<div class="mb-1 grid grid-cols-[1fr_2rem_1fr]">
			<p class="text-center text-xs">
				<span class={cn('font-semibold', leftAccent === 'pink' ? 'text-pink-600' : 'text-cyan-600')}
					>左</span
				>
				{#if leftSidePlayers[0].teamName}
					<span class="text-muted-emphasis">
						{leftSidePlayers[0].teamName}
					</span>
				{/if}
			</p>
			<div></div>
			<p class="text-center text-xs">
				<span
					class={cn('font-semibold', rightAccent === 'pink' ? 'text-pink-600' : 'text-cyan-600')}
					>右</span
				>
				{#if rightSidePlayers[0].teamName}
					<span class="text-muted-emphasis">
						{leftSidePlayers[0].teamName}
					</span>
				{/if}
			</p>
		</div>

		{#if leftCA && rightCA}
			<div
				class="grid grid-cols-[1fr_2rem_1fr] overflow-hidden rounded-xl border-2 border-zinc-300"
			>
				<div class="col-start-1 row-start-1">
					{@render playerCell(leftCA.left, leftAccent, true)}
				</div>
				<div
					class="col-start-2 row-span-2 row-start-1 flex items-center justify-center border-x-2 border-zinc-400 bg-zinc-100"
				>
					<span
						class="text-[10px] font-medium tracking-widest text-muted"
						style="writing-mode: vertical-rl">ネット</span
					>
				</div>
				<div class="col-start-3 row-start-1">
					{@render playerCell(rightCA.right, rightAccent, true)}
				</div>
				<div class="col-start-1 row-start-2">
					{@render playerCell(leftCA.right, leftAccent, false)}
				</div>
				<div class="col-start-3 row-start-2">
					{@render playerCell(rightCA.left, rightAccent, false)}
				</div>
			</div>
		{:else}
			{@const leftPlayer = leftSidePlayers[0]}
			{@const rightPlayer = rightSidePlayers[0]}
			<div
				class="grid grid-cols-[1fr_2rem_1fr] overflow-hidden rounded-xl border-2 border-zinc-300"
			>
				{#if leftPlayer}
					<div>{@render playerCell(leftPlayer.id, leftAccent, false)}</div>
				{/if}
				<div class="flex items-center justify-center border-x-2 border-zinc-400 bg-zinc-100">
					<span
						class="text-[10px] font-medium tracking-widest text-muted"
						style="writing-mode: vertical-rl">NET</span
					>
				</div>
				{#if rightPlayer}
					<div>{@render playerCell(rightPlayer.id, rightAccent, false)}</div>
				{/if}
			</div>
		{/if}
	</Card>
{/if}
