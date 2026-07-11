<script lang="ts">
	import { Button } from 'bits-ui';
	import { LoaderCircle } from '@lucide/svelte';
	import type { ComponentProps } from 'svelte';
	import { tv, type VariantProps } from 'tailwind-variants';
	import { cn } from '$lib/utils/cn';

	let {
		variant = 'primary',
		size = 'md',
		loading = false,
		disabled = false,
		class: className = '',
		children,
		...restProps
	}: ComponentProps<typeof Button.Root> & {
		variant?: VariantProps<typeof buttonStyles>['variant'];
		size?: VariantProps<typeof buttonStyles>['size'];
		loading?: boolean;
		disabled?: boolean;
	} = $props();

	const buttonStyles = tv({
		base: 'inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
		variants: {
			variant: {
				primary: 'rounded-xl bg-zinc-950 font-medium text-white hover:bg-zinc-800',
				secondary:
					'rounded-xl border border-border bg-white font-medium text-zinc-700 hover:bg-zinc-100',
				ghost: 'font-medium text-zinc-700 hover:text-default',
				danger: 'rounded-xl bg-red-600 font-bold text-white shadow-sm hover:bg-red-700',
				success: 'rounded-xl bg-emerald-700 font-medium text-white hover:bg-emerald-800',
				warning: 'rounded-xl bg-amber-100 font-medium text-amber-800 hover:bg-amber-200',
				violet:
					'rounded-xl border border-violet-200 bg-violet-50 font-medium text-violet-700 hover:bg-violet-100'
			},
			size: {
				sm: 'px-3 py-3 text-xs',
				md: 'px-4 py-3 text-sm',
				lg: 'px-6 py-3.5 text-sm'
			}
		}
	});
</script>

<Button.Root
	class={cn(buttonStyles({ variant, size }), className)}
	disabled={loading || disabled}
	aria-busy={loading || undefined}
	{...restProps}
>
	{#if loading}
		<LoaderCircle class="h-4 w-4 animate-spin" />
	{/if}
	{@render children?.()}
</Button.Root>
