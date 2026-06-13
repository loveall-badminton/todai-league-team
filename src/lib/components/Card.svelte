<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	let { children, class: className = '' }: { children: Snippet; class?: string } = $props();
</script>

<div class={cn('rounded-2xl border border-zinc-200 bg-white shadow-sm', className)}>
	{@render children()}
</div>
