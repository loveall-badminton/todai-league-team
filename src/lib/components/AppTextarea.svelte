<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';

	let { class: className = '', ...restProps }: HTMLTextareaAttributes = $props();
</script>

<textarea
	class={cn(
		'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-950',
		className
	)}
	{...restProps}
></textarea>
