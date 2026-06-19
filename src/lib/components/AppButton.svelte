<script lang="ts">
	import { Button } from 'bits-ui';
	import type { ComponentProps } from 'svelte';
	import { tv, type VariantProps } from 'tailwind-variants';
	import { cn } from '$lib/utils/cn';

	let {
		variant = 'primary',
		size = 'md',
		class: className = '',
		children,
		...restProps
	}: ComponentProps<typeof Button.Root> & {
		variant?: VariantProps<typeof buttonStyles>['variant'];
		size?: VariantProps<typeof buttonStyles>['size'];
	} = $props();

	const buttonStyles = tv({
		base: 'inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
		variants: {
			variant: {
				primary: 'rounded-xl bg-zinc-950 font-medium text-white hover:bg-zinc-800',
				secondary:
					'rounded-xl border border-zinc-200 bg-white font-medium text-zinc-700 hover:bg-zinc-50',
				ghost: 'font-medium text-zinc-700 hover:text-zinc-950',
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

<Button.Root class={cn(buttonStyles({ variant, size }), className)} {...restProps}>
	{@render children?.()}
</Button.Root>
