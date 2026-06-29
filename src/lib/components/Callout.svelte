<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { Info, Lightbulb, ShieldAlert, TriangleAlert } from '@lucide/svelte';

	type Variant = 'info' | 'warning' | 'danger' | 'tip';

	let {
		variant = 'info',
		children
	}: {
		variant?: Variant;
		children: import('svelte').Snippet;
	} = $props();

	const icons: Record<Variant, typeof Info> = {
		info: Info,
		warning: TriangleAlert,
		danger: ShieldAlert,
		tip: Lightbulb
	};
	const styles: Record<Variant, string> = {
		info: 'border-blue-200 bg-blue-50 text-blue-800',
		warning: 'border-amber-200 bg-amber-50 text-amber-800',
		danger: 'border-red-200 bg-red-50 text-red-800',
		tip: 'border-emerald-200 bg-emerald-50 text-emerald-800'
	};

	let Icon = $derived(icons[variant]);
</script>

<div class={cn('my-4 rounded-xl border px-4 py-3 text-sm leading-relaxed', styles[variant])}>
	<div class="flex items-start gap-2.5">
		<Icon class="mt-0.5 h-4 w-4 shrink-0" />
		<div>
			{@render children()}
		</div>
	</div>
</div>
