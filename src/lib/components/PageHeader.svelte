<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	let {
		eyebrow,
		title,
		description,
		actions,
		class: className = ''
	}: {
		eyebrow?: string;
		title: string;
		description?: string;
		actions?: Snippet;
		class?: string;
	} = $props();
</script>

<header class={cn('flex flex-wrap items-start justify-between gap-4', className)}>
	<div class="min-w-0 space-y-1">
		{#if eyebrow}
			<p class="text-xs font-medium tracking-wide text-zinc-500 uppercase">{eyebrow}</p>
		{/if}
		<h1 class="text-2xl font-semibold tracking-tight text-zinc-950">{title}</h1>
		{#if description}
			<p class="text-sm text-zinc-500">{description}</p>
		{/if}
	</div>

	{#if actions}
		<div class="shrink-0">{@render actions()}</div>
	{/if}
</header>
