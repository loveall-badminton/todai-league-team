<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { X } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';

	let { class: className = '' }: { class?: string } = $props();
</script>

<Dialog.Close
	class={cn('rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700', className)}
>
	<X class="size-4" />
</Dialog.Close>
