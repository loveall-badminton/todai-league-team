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
		variant = 'default',
		labelClass = '',
		class: className = '',
		onCheckedChange
	}: {
		name?: string;
		value?: string;
		checked?: boolean;
		disabled?: boolean;
		label?: string;
		variant?: 'default' | 'danger';
		labelClass?: string;
		class?: string;
		onCheckedChange?: () => void;
	} = $props();

	const variantStyles = {
		default: {
			uncheckedBox: 'border-zinc-300 bg-white',
			checkedBox: 'border-zinc-950 bg-zinc-950',
			label: 'text-zinc-700'
		},
		danger: {
			uncheckedBox: 'border-red-300 bg-white',
			checkedBox: 'border-red-600 bg-red-600',
			label: 'text-red-900'
		}
	} as const;
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
			checked ? variantStyles[variant].checkedBox : variantStyles[variant].uncheckedBox,
			disabled && 'opacity-50'
		)}
	>
		{#if checked}
			<Check class="size-3 text-white" />
		{/if}
	</div>
	{#if label}
		<span class={cn('text-sm', variantStyles[variant].label, disabled && 'opacity-50', labelClass)}
			>{label}</span
		>
	{/if}
</Checkbox.Root>
