<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { Check, ChevronDown } from '@lucide/svelte';
	import { Select } from 'bits-ui';
	import type { SelectItemWithDisabled } from '$lib/types/ui';

	let {
		name,
		value = $bindable([]),
		placeholder = '選択',
		disabled = false,
		items,
		class: className = '',
		onValueChange
	}: {
		name: string;
		value?: string[];
		placeholder?: string;
		disabled?: boolean;
		items: SelectItemWithDisabled[];
		class?: string;
		onValueChange?: (value: string[]) => void;
	} = $props();

	let normalizedItems = $derived(
		Array.from(new Map(items.map((item) => [item.value, item])).values())
	);
	let selectedLabels = $derived(
		value
			.map((selectedValue) => normalizedItems.find((item) => item.value === selectedValue)?.label)
			.filter((label): label is string => !!label)
	);
	let displayLabel = $derived(selectedLabels.length > 0 ? selectedLabels.join('、') : placeholder);
	let fieldName = $derived(name.endsWith('[]') ? name : `${name}[]`);
</script>

<Select.Root
	type="multiple"
	name={fieldName}
	bind:value
	{disabled}
	items={normalizedItems.map((item) => ({
		value: item.value,
		label: item.label,
		disabled: item.disabled ?? false
	}))}
	onValueChange={(nextValue) => onValueChange?.(nextValue)}
>
	<Select.Trigger
		class={cn(
			'flex w-full min-w-0 items-center justify-between rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-950 disabled:opacity-50',
			className
		)}
	>
		<Select.Value class="min-w-0 flex-1 text-left">
			<span class={cn('block truncate', value.length > 0 ? 'text-zinc-900' : 'text-muted')}>
				{displayLabel}
			</span>
		</Select.Value>
		<ChevronDown class="ml-2 h-4 w-4 shrink-0 text-muted" />
	</Select.Trigger>
	<Select.Portal>
		<Select.Content
			class="z-50 min-w-32 overflow-hidden rounded-xl border border-border bg-white shadow-md"
			sideOffset={4}
		>
			<Select.Viewport class="max-h-64 p-1">
				{#each normalizedItems as item, index (`${item.value}-${index}`)}
					<Select.Item
						value={item.value}
						label={item.label}
						disabled={item.disabled}
						class="relative flex cursor-default items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-700 outline-none select-none data-disabled:opacity-50 data-highlighted:bg-zinc-100 data-selected:font-medium data-selected:text-default"
					>
						{#snippet children({ selected })}
							<span class="min-w-0 flex-1 truncate">{item.label}</span>
							{#if selected}
								<Check class="h-4 w-4 shrink-0 text-default" />
							{/if}
						{/snippet}
					</Select.Item>
				{/each}
			</Select.Viewport>
		</Select.Content>
	</Select.Portal>
</Select.Root>
