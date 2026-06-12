<script lang="ts">
	import type { Snippet } from 'svelte';

	let { message, children }: { message: string; children?: Snippet } = $props();
</script>

<div
	class="rounded-xl border border-dashed border-zinc-300 bg-white py-12 text-center text-sm text-zinc-500"
>
	{#if children}
		{@render children()}
	{/if}
	<p>{message}</p>
</div>
