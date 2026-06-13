<script lang="ts">
	import { cn } from '$lib/utils/cn';
	let { message }: { message?: string | null } = $props();
</script>

{#if message}
	<div class={cn('rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700')}>
		{message}
	</div>
{/if}
