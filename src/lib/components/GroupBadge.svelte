<script lang="ts">
	let { groupCode }: { groupCode: string | null } = $props();

	const label = $derived(
		groupCode === 'A' ? 'Aリーグ' : groupCode === 'B' ? 'Bリーグ' : '未割当'
	);
	const classes = $derived(
		groupCode === 'A'
			? 'bg-blue-100 text-blue-800'
			: groupCode === 'B'
				? 'bg-violet-100 text-violet-800'
				: 'bg-zinc-100 text-zinc-600'
	);
</script>

<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold {classes}">
	{label}
</span>
