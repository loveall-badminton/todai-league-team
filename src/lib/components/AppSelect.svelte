<script lang="ts">
	import { Select } from 'bits-ui';
	import { ChevronDown } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';

	let {
		name,
		value = $bindable(''),
		placeholder = '選択してください',
		required = false,
		disabled = false,
		items,
		class: className = '',
		onValueChange,
		'aria-invalid': ariaInvalid = undefined,
		...restProps
	}: {
		name: string;
		value?: string;
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
		items: { value: string; label: string }[];
		class?: string;
		onValueChange?: (value: string) => void;
		'aria-invalid'?: boolean | 'false' | 'true';
	} = $props();

	let selectedLabel = $derived(items.find((i) => i.value === value)?.label ?? placeholder);
	const invalid = $derived(ariaInvalid === true || ariaInvalid === 'true');
</script>

<Select.Root
	type="single"
	{name}
	bind:value
	{required}
	{disabled}
	{...restProps}
	items={items.map((i) => ({ value: i.value, label: i.label, disabled: false }))}
	onValueChange={(v) => onValueChange?.(v ?? '')}
>
	<Select.Trigger
		aria-invalid={ariaInvalid}
		class={cn(
			'flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 disabled:opacity-50',
			invalid ? 'border-red-400 focus:ring-red-500' : 'border-zinc-200 focus:ring-zinc-950',
			className
		)}
	>
		<Select.Value>
			<span class={value ? 'text-zinc-900' : 'text-zinc-400'}>{selectedLabel}</span>
		</Select.Value>
		<ChevronDown class="h-4 w-4 shrink-0 text-zinc-400" />
	</Select.Trigger>
	<Select.Portal>
		<Select.Content
			class="z-50 min-w-32 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-md"
			sideOffset={4}
		>
			<Select.Viewport class="p-1">
				{#each items as item (item.value)}
					<Select.Item
						value={item.value}
						label={item.label}
						class="relative flex cursor-default items-center rounded-lg px-3 py-2 text-sm text-zinc-700 outline-none select-none data-highlighted:bg-zinc-100 data-selected:font-medium data-selected:text-zinc-950"
					>
						{item.label}
					</Select.Item>
				{/each}
			</Select.Viewport>
		</Select.Content>
	</Select.Portal>
</Select.Root>
