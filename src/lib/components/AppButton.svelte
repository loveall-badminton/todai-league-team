<script lang="ts">
	import { Button } from 'bits-ui';
	import type { ComponentProps } from 'svelte';
	import { tv, type VariantProps } from 'tailwind-variants';
	import { cn } from '$lib/utils/cn';

	let {
		variant = 'primary',
		class: className = '',
		children,
		...restProps
	}: ComponentProps<typeof Button.Root> & {
		variant?: VariantProps<typeof buttonStyles>['variant'];
	} = $props();

	const buttonStyles = tv({
		base: 'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
		variants: {
			variant: {
				primary:
					'rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800',
				secondary:
					'rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50',
				ghost: 'text-sm font-medium text-zinc-700 hover:text-zinc-950'
			}
		},
		defaultVariants: {
			variant: 'primary'
		}
	});
</script>

<Button.Root class={cn(buttonStyles({ variant }), className)} {...restProps}>
	{@render children?.()}
</Button.Root>
