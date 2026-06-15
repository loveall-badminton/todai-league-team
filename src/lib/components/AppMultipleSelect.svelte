<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { Check, ChevronDown } from '@lucide/svelte';
	import { Select } from 'bits-ui';

	type SelectItem = {
		value: string;
		label: string;
		disabled?: boolean;
	};

	let {
		name,
		value = $bindable([]),
		placeholder = '選択してください',
		disabled = false,
		items,
		class: className = '',
		onValueChange
	}: {
		name: string;
		value?: string[];
		placeholder?: string;
		disabled?: boolean;
		items: SelectItem[];
		class?: string;
		onValueChange?: (value: string[]) => void;
	} = $props();

	let selectedLabels = $derived(
		value
			.map((selectedValue) => items.find((item) => item.value === selectedValue)?.label)
			.filter((label): label is string => !!label)
	);
	let displayLabel = $derived(selectedLabels.length > 0 ? selectedLabels.join('、') : placeholder);
</script>

<Select.Root
	type="multiple"
	{name}
	bind:value
	{disabled}
	items={items.map((item) => ({
		value: item.value,
		label: item.label,
		disabled: item.disabled ?? false
	}))}
	onValueChange={(nextValue) => onValueChange?.(nextValue)}
>
	<Select.Trigger
		class={cn(
			'flex w-full min-w-0 items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-950 disabled:opacity-50',
			className
		)}
	>
		<Select.Value class="min-w-0 flex-1 text-left">
			<span class={cn('block truncate', value.length > 0 ? 'text-zinc-900' : 'text-zinc-400')}>
				{displayLabel}
			</span>
		</Select.Value>
		<ChevronDown class="ml-2 h-4 w-4 shrink-0 text-zinc-400" />
	</Select.Trigger>
	<Select.Portal>
		<Select.Content
			class="z-50 min-w-32 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-md"
			sideOffset={4}
		>
			<Select.Viewport class="max-h-64 p-1">
				{#each items as item (item.value)}
					<Select.Item
						value={item.value}
						label={item.label}
						disabled={item.disabled}
						class="relative flex cursor-default items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-700 outline-none select-none data-disabled:opacity-50 data-highlighted:bg-zinc-100 data-selected:font-medium data-selected:text-zinc-950"
					>
						{#snippet children({ selected })}
							<span class="min-w-0 flex-1 truncate">{item.label}</span>
							{#if selected}
								<Check class="h-4 w-4 shrink-0 text-zinc-950" />
							{/if}
						{/snippet}
					</Select.Item>
				{/each}
			</Select.Viewport>
		</Select.Content>
	</Select.Portal>
</Select.Root>
