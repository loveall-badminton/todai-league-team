<script lang="ts">
	import { Tabs } from 'bits-ui';
	import { cn } from '$lib/utils/cn';
	import type { SelectItemWithCount } from '$lib/types/ui';

	let {
		value = $bindable(''),
		items = [],
		onValueChange,
		listClass = '',
		triggerClass = ''
	}: {
		value?: string;
		items: SelectItemWithCount[];
		onValueChange?: (value: string) => void;
		listClass?: string;
		triggerClass?: string;
	} = $props();
</script>

<Tabs.Root
	{value}
	onValueChange={(v) => {
		value = v ?? '';
		onValueChange?.(value);
	}}
>
	<Tabs.List class={cn('flex scrollbar-none gap-1.5 overflow-x-auto pb-0.5', listClass)}>
		{#each items as item (item.value)}
			<Tabs.Trigger
				value={item.value}
				class={cn(
					'shrink-0 rounded-full px-3 py-2 text-xs font-medium transition-colors',
					value === item.value
						? 'bg-zinc-900 text-white'
						: 'border border-border bg-white text-muted-emphasis hover:border-zinc-400',
					triggerClass
				)}
			>
				{item.label}
				{#if item.count !== undefined}
					<span class={cn('ml-1', value === item.value ? 'text-zinc-300' : 'text-muted')}>
						{item.count}
					</span>
				{/if}
			</Tabs.Trigger>
		{/each}
	</Tabs.List>
</Tabs.Root>
