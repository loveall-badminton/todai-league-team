<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	let {
		label,
		class: className = '',
		children
	}: {
		label: string;
		class?: string;
		children: Snippet;
	} = $props();
</script>

<div class={cn('grid gap-1', className)}>
	<!-- svelte-ignore a11y_label_has_associated_control -->
	<label class="text-xs font-medium text-zinc-500">{label}</label>
	{@render children()}
</div>
