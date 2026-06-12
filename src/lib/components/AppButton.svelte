<script lang="ts">
	import { Button } from 'bits-ui';
	import type { ComponentProps } from 'svelte';

	let {
		variant = 'primary',
		class: className = '',
		children,
		...restProps
	}: ComponentProps<typeof Button.Root> & { variant?: 'primary' | 'secondary' | 'ghost' } = $props();

	const baseClass = $derived(
		variant === 'primary'
			? 'rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
			: variant === 'secondary'
				? 'rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors'
				: 'text-sm font-medium text-zinc-700 hover:text-zinc-950 transition-colors'
	);
</script>

<Button.Root class="{baseClass} {className}" {...restProps}>
	{@render children?.()}
</Button.Root>
