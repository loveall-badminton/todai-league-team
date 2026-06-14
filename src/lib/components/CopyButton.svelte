<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { Check, Clipboard } from '@lucide/svelte';

	let { text, class: className = '' }: { text: string; class?: string } = $props();

	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | null = null;

	async function copy() {
		await navigator.clipboard.writeText(text);
		copied = true;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			copied = false;
			timer = null;
		}, 1500);
	}
</script>

<button
	type="button"
	onclick={copy}
	title="クリップボードにコピー"
	class={cn(
		'inline-flex items-center justify-center rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600',
		copied && 'text-green-500 hover:text-green-500',
		className
	)}
>
	{#if copied}
		<Check class="h-4 w-4" />
	{:else}
		<Clipboard class="h-4 w-4" />
	{/if}
</button>
