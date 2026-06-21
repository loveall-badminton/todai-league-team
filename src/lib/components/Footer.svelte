<script lang="ts">
	import { cn } from '$lib/utils/cn';

	const today = new Date();

	let { class: className }: { class?: string } = $props();
</script>

<footer
	class={cn(
		'border-t border-border bg-white px-4 py-5 text-center text-xs font-medium text-muted-foreground',
		className
	)}
>
	&copy; {today.getFullYear()} 東京大学ラブオール
</footer>
