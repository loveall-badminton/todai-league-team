<script lang="ts">
	import { tieStatusLabel } from '$lib/domain/tokyoLeagueLabels';

	let { status }: { status: string } = $props();

	const colorMap: Record<string, string> = {
		scheduled: 'bg-zinc-100 text-zinc-700',
		lineup_pending: 'bg-amber-100 text-amber-800',
		lineup_submitted: 'bg-blue-100 text-blue-800',
		ready: 'bg-violet-100 text-violet-800',
		playing: 'bg-green-100 text-green-800',
		finished: 'bg-orange-100 text-orange-800',
		confirmed: 'bg-emerald-100 text-emerald-800',
		cancelled: 'bg-red-100 text-red-800'
	};

	const classes = $derived(colorMap[status] ?? 'bg-zinc-100 text-zinc-700');
</script>

<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {classes}">
	{tieStatusLabel(status)}
</span>
