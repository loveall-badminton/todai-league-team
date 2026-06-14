<script lang="ts">
	import { tv, type VariantProps } from 'tailwind-variants';
	import { cn } from '$lib/utils/cn';

	let {
		variant = 'subtle',
		color = 'zinc',
		size = 'sm',
		class: className = '',
		children
	}: {
		variant?: VariantProps<typeof badgeStyles>['variant'];
		color?: VariantProps<typeof badgeStyles>['color'];
		size?: VariantProps<typeof badgeStyles>['size'];
		class?: string;
		children?: import('svelte').Snippet;
	} = $props();

	const badgeStyles = tv({
		base: 'inline-flex items-center rounded-full font-medium',
		variants: {
			variant: {
				subtle: '',
				outline: 'border bg-transparent',
				solid: 'text-white'
			},
			color: {
				zinc: '',
				amber: '',
				blue: '',
				violet: '',
				green: '',
				emerald: '',
				orange: '',
				red: '',
				sky: '',
				rose: ''
			},
			size: {
				sm: 'px-2 py-0.5 text-xs',
				md: 'px-2.5 py-1 text-sm'
			}
		},
		compoundVariants: [
			{ variant: 'subtle', color: 'zinc', class: 'bg-zinc-100 text-zinc-700' },
			{ variant: 'subtle', color: 'amber', class: 'bg-amber-100 text-amber-800' },
			{ variant: 'subtle', color: 'blue', class: 'bg-blue-100 text-blue-800' },
			{ variant: 'subtle', color: 'violet', class: 'bg-violet-100 text-violet-800' },
			{ variant: 'subtle', color: 'green', class: 'bg-green-100 text-green-800' },
			{ variant: 'subtle', color: 'emerald', class: 'bg-emerald-100 text-emerald-800' },
			{ variant: 'subtle', color: 'orange', class: 'bg-orange-100 text-orange-800' },
			{ variant: 'subtle', color: 'red', class: 'bg-red-100 text-red-800' },
			{ variant: 'subtle', color: 'sky', class: 'bg-sky-100 text-sky-700' },
			{ variant: 'subtle', color: 'rose', class: 'bg-rose-50 text-rose-700' },
			{ variant: 'outline', color: 'zinc', class: 'border-zinc-300 text-zinc-600' },
			{ variant: 'outline', color: 'amber', class: 'border-amber-300 text-amber-700' },
			{ variant: 'outline', color: 'emerald', class: 'border-emerald-300 text-emerald-700' },
			{ variant: 'outline', color: 'red', class: 'border-red-300 text-red-700' },
			{ variant: 'solid', color: 'zinc', class: 'bg-zinc-900' },
			{ variant: 'solid', color: 'emerald', class: 'bg-emerald-700' },
			{ variant: 'solid', color: 'red', class: 'bg-red-600' },
			{ variant: 'solid', color: 'amber', class: 'bg-amber-600' },
			{ variant: 'solid', color: 'blue', class: 'bg-blue-600' },
			{ variant: 'solid', color: 'violet', class: 'bg-violet-600' }
		],
		defaultVariants: {
			variant: 'subtle',
			color: 'zinc',
			size: 'sm'
		}
	});
</script>

<span class={cn(badgeStyles({ variant, color, size }), className)}>
	{@render children?.()}
</span>
