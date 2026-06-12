<script lang="ts">
	import { Checkbox } from 'bits-ui';
	import { Check } from '@lucide/svelte';

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
	class="flex items-center gap-2 {className}"
>
	<div
		class="flex size-4 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white
			data-[state=checked]:border-zinc-950 data-[state=checked]:bg-zinc-950
			data-[disabled]:opacity-50"
	>
		<Checkbox.Indicator>
			<Check class="size-3 text-white" />
		</Checkbox.Indicator>
	</div>
	{#if label}
		<span class="text-sm text-zinc-700 {disabled ? 'opacity-50' : ''}">{label}</span>
	{/if}
</Checkbox.Root>
