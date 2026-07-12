<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { Tooltip } from 'bits-ui';
	import type { Component } from 'svelte';

	let {
		Icon,
		label,
		value,
		class: className = '',
		iconClass = 'size-3 shrink-0',
		textClass = ''
	}: {
		Icon: Component;
		label: string;
		value: string;
		class?: string;
		iconClass?: string;
		textClass?: string;
	} = $props();

	let tooltip = $derived(`${label}: ${value}`);
</script>

<Tooltip.Provider delayDuration={150} skipDelayDuration={100}>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<span
					{...props}
					class={cn('inline-flex items-center gap-1', className)}
					aria-label={tooltip}
				>
					<Icon class={iconClass} />
					<span class={textClass}>{value}</span>
				</span>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content
			side="top"
			sideOffset={6}
			class="z-50 rounded-md bg-zinc-950 px-2 py-1 text-[11px] font-medium text-white shadow-lg"
		>
			{tooltip}
		</Tooltip.Content>
	</Tooltip.Root>
</Tooltip.Provider>
