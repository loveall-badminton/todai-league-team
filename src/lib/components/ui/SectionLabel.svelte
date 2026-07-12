<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	let {
		class: className = '',
		children
	}: {
		class?: string;
		children?: Snippet;
	} = $props();
</script>

<h2 class={cn('text-xs font-semibold tracking-wider text-muted', className)}>
	{@render children?.()}
</h2>
