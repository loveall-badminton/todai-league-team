<script lang="ts">
	import { tv, type VariantProps } from 'tailwind-variants';
	import { cn } from '$lib/utils/cn';

	let {
		variant = 'info',
		class: className = '',
		children
	}: {
		variant?: VariantProps<typeof messageStyles>['variant'];
		class?: string;
		children?: import('svelte').Snippet;
	} = $props();

	const messageStyles = tv({
		base: 'rounded-lg border px-4 py-3 text-sm',
		variants: {
			variant: {
				info: 'border-zinc-200 bg-white text-zinc-700',
				success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
				warning: 'border-amber-200 bg-amber-50 text-amber-800',
				error: 'border-red-200 bg-red-50 text-red-700'
			}
		},
		defaultVariants: {
			variant: 'info'
		}
	});
</script>

<div class={cn(messageStyles({ variant }), className)}>
	{@render children?.()}
</div>
