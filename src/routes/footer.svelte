<script lang="ts">
	import { cn } from '$lib/utils/cn';

	const today = new Date();

	let { class: className }: { class?: string } = $props();
</script>

<footer class={cn('border-t border-zinc-200 bg-white', className)}>
	<div class="px-4 py-5 text-center text-xs font-medium text-zinc-500">
		&copy; {today.getFullYear()} 東京大学ラブオール
	</div>
</footer>
