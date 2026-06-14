<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<div class="animate-pulse rounded-2xl border border-zinc-100 bg-white {className}">
	<div class="p-4 space-y-3">
		<div class="h-2.5 w-20 rounded-full bg-zinc-200"></div>
		<div class="h-4 w-40 rounded-full bg-zinc-200"></div>
		<div class="h-2.5 w-28 rounded-full bg-zinc-200"></div>
	</div>
</div>
