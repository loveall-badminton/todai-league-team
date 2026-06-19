<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';

	let {
		class: className = '',
		value = $bindable(),
		'aria-invalid': ariaInvalid,
		...restProps
	}: HTMLInputAttributes = $props();

	const invalid = $derived(ariaInvalid === true || ariaInvalid === 'true');
</script>

<input
	class={cn(
		'w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2',
		invalid ? 'border-red-400 focus:ring-red-500' : 'border-zinc-200 focus:ring-zinc-950',
		className
	)}
	{value}
	aria-invalid={ariaInvalid}
	{...restProps}
/>
