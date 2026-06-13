<script lang="ts">
	import { Checkbox } from 'bits-ui';
	import { Check } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';

	let {
		name,
		value = 'on',
		checked = $bindable(false),
		disabled = false,
		label,
		class: className = '',
		onCheckedChange
	}: {
		name?: string;
		value?: string;
		checked?: boolean;
		disabled?: boolean;
		label?: string;
		class?: string;
		onCheckedChange?: () => void;
	} = $props();
</script>

<Checkbox.Root
	{name}
	{value}
	bind:checked
	{disabled}
	onCheckedChange={() => onCheckedChange?.()}
	class={cn('flex items-center gap-2', className)}
>
	<div
		class={cn(
			'flex size-4 shrink-0 items-center justify-center rounded border',
			checked ? 'border-zinc-950 bg-zinc-950' : 'border-zinc-300 bg-white',
			disabled && 'opacity-50'
		)}
	>
		{#if checked}
			<Check class="size-3 text-white" />
		{/if}
	</div>
	{#if label}
		<span class={cn('text-sm text-zinc-700', disabled && 'opacity-50')}>{label}</span>
	{/if}
</Checkbox.Root>
