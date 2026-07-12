<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	let {
		children,
		header,
		flush = false,
		class: className = '',
		innerClass: innerClassName = ''
	}: {
		children: Snippet;
		header?: Snippet;
		flush?: boolean;
		class?: string;
		innerClass?: string;
	} = $props();
</script>

<div class={cn('rounded-2xl border border-border bg-white', className)}>
	{#if header}
		<div class="flex items-center justify-between border-b border-border-subtle px-5 py-4">
			{@render header()}
		</div>
	{/if}
	<div class={cn(!flush && 'p-5', innerClassName)}>
		{@render children()}
	</div>
</div>
