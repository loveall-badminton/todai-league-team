<script lang="ts">
	import { Switch } from 'bits-ui';
	import type { ComponentProps } from 'svelte';
	import { cn } from '$lib/utils/cn';

	let {
		checked = $bindable(false),
		label,
		class: className = '',
		...rootProps
	}: ComponentProps<typeof Switch.Root> & {
		label?: string;
		class?: string;
	} = $props();
</script>

<label class={cn('flex cursor-pointer items-center gap-2 select-none', className)}>
	<Switch.Root
		bind:checked
		{...rootProps}
		class="relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 focus-visible:outline-none data-[state=checked]:bg-zinc-900 data-[state=unchecked]:bg-zinc-200"
	>
		<Switch.Thumb
			class="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
		/>
	</Switch.Root>
	{#if label}
		<span class="text-sm text-zinc-700">{label}</span>
	{/if}
</label>
