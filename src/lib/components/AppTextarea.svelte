<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';

	let {
		class: className = '',
		value = $bindable(''),
		...restProps
	}: HTMLTextareaAttributes = $props();
</script>

<textarea
	class={cn(
		'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zinc-950',
		className
	)}
	bind:value
	{...restProps}></textarea>
