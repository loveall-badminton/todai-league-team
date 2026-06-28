<script lang="ts">
	import { tick } from 'svelte';
	import { Select } from 'bits-ui';
	import { ChevronDown } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import type { SelectItem } from '$lib/types/ui';

	let {
		name,
		value = $bindable(''),
		placeholder = '選択',
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
		items: SelectItem[];
		class?: string;
		onValueChange?: (value: string) => void;
		'aria-invalid'?: boolean | 'false' | 'true';
	} = $props();

	let selectedLabel = $derived(items.find((i) => i.value === value)?.label ?? placeholder);
	const invalid = $derived(ariaInvalid === true || ariaInvalid === 'true');
	let triggerRef: HTMLButtonElement | null = $state(null);

	$effect(() => {
		const form = triggerRef?.closest('form');
		if (!form) return;
		const handleReset = async () => {
			const valueBeforeReset = value;
			await tick();
			value = valueBeforeReset;
		};
		form.addEventListener('reset', handleReset, { capture: true });
		return () => form.removeEventListener('reset', handleReset, { capture: true });
	});
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
		bind:ref={triggerRef}
		aria-invalid={ariaInvalid}
		class={cn(
			'flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 disabled:opacity-50',
			invalid ? 'border-red-400 focus:ring-red-500' : 'border-border focus:ring-zinc-950',
			className
		)}
	>
		<Select.Value>
			<span class={value ? 'text-zinc-900' : 'text-muted'}>{selectedLabel}</span>
		</Select.Value>
		<ChevronDown class="h-4 w-4 shrink-0 text-muted" />
	</Select.Trigger>
	<Select.Content
		class="z-50 min-w-32 overflow-hidden rounded-xl border border-border bg-white shadow-md"
		sideOffset={4}
	>
		<Select.Viewport class="p-1">
			{#each items as item (item.value)}
				<Select.Item
					value={item.value}
					label={item.label}
					class="relative flex cursor-default items-center rounded-lg px-3 py-2 text-sm text-zinc-700 outline-none select-none data-highlighted:bg-zinc-100 data-selected:font-medium data-selected:text-default"
				>
					{item.label}
				</Select.Item>
			{/each}
		</Select.Viewport>
	</Select.Content>
</Select.Root>
