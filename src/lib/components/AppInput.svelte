<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let { class: className = '', ...restProps }: HTMLInputAttributes = $props();
</script>

<input
	class="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-950 {className}"
	{...restProps}
/>
