<script lang="ts">
	import { ArrowLeft, ArrowLeftRight, ArrowRight } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import AppButton from './AppButton.svelte';

	let {
		leftTeamName,
		rightTeamName,
		leftPlayers,
		rightPlayers,
		accentLeft = 'pink',
		accentRight = 'cyan',
		label = 'チェンジエンド',
		ontoggle
	}: {
		leftTeamName?: string | null;
		rightTeamName?: string | null;
		leftPlayers?: string[];
		rightPlayers?: string[];
		accentLeft?: 'pink' | 'cyan';
		accentRight?: 'pink' | 'cyan';
		label?: string;
		ontoggle?: () => void;
	} = $props();

	const showPreview = $derived((leftPlayers?.length ?? 0) > 0 || (rightPlayers?.length ?? 0) > 0);
</script>

<div class="grid gap-2">
	{#if showPreview}
		<div class="grid grid-cols-2 gap-2">
			<div
				class={cn(
					'flex min-w-0 flex-col gap-0.5 rounded-xl border px-3 py-2',
					accentLeft === 'pink' ? 'border-pink-200 bg-pink-50' : 'border-cyan-200 bg-cyan-50'
				)}
			>
				<p
					class={cn(
						'text-[11px] font-semibold tracking-wide',
						accentLeft === 'pink' ? 'text-pink-700' : 'text-cyan-700'
					)}
				>
					<ArrowLeft class="inline size-3" /> 左コート
				</p>
				{#if leftPlayers && leftPlayers.length > 0}
					<p class="text-sm leading-snug font-semibold text-default">
						{leftPlayers.join(' / ')}
					</p>
				{/if}
				{#if leftTeamName}
					<p class="truncate text-xs text-muted-foreground">{leftTeamName}</p>
				{/if}
			</div>

			<div
				class={cn(
					'flex min-w-0 flex-col items-end gap-0.5 rounded-xl border px-3 py-2 text-right',
					accentRight === 'cyan' ? 'border-cyan-200 bg-cyan-50' : 'border-pink-200 bg-pink-50'
				)}
			>
				<p
					class={cn(
						'text-[11px] font-semibold tracking-wide',
						accentRight === 'cyan' ? 'text-cyan-700' : 'text-pink-700'
					)}
				>
					右コート <ArrowRight class="inline size-3" />
				</p>
				{#if rightPlayers && rightPlayers.length > 0}
					<p class="text-sm leading-snug font-semibold text-default">
						{rightPlayers.join(' / ')}
					</p>
				{/if}
				{#if rightTeamName}
					<p class="w-full truncate text-xs text-muted-foreground">{rightTeamName}</p>
				{/if}
			</div>
		</div>
	{/if}

	<AppButton
		onclick={ontoggle}
		variant="secondary"
		class="w-full py-3 active:scale-[0.99]"
		aria-label={label}
	>
		<ArrowLeftRight class="h-4 w-4" />
		<span>{label}</span>
	</AppButton>
</div>
