<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';

	let { class: className = '', value = $bindable(), ...restProps }: HTMLInputAttributes = $props();
</script>

<input
	class={cn(
		'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-950',
		className
	)}
	{value}
	{...restProps}
/>
