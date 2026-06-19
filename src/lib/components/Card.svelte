<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	let {
		children,
		header,
		flush = false,
		class: className = ''
	}: {
		children: Snippet;
		header?: Snippet;
		flush?: boolean;
		class?: string;
	} = $props();
</script>

<div class={cn('rounded-2xl border border-zinc-200 bg-white', className)}>
	{#if header}
		<div class="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
			{@render header()}
		</div>
	{/if}
	<div class={cn(!flush && 'p-5')}>
		{@render children()}
	</div>
</div>
