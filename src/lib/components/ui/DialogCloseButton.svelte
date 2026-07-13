<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { X } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';

	let { class: className = '' }: { class?: string } = $props();
</script>

<Dialog.Close
	aria-label="閉じる"
	class={cn('rounded-lg p-1.5 text-muted hover:bg-zinc-100 hover:text-zinc-700', className)}
>
	<X class="size-4" />
</Dialog.Close>
