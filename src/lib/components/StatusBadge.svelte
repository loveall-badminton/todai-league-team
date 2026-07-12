<script lang="ts">
	import Badge from './ui/Badge.svelte';
	import { tieStatusLabel } from '$lib/domain/tokyoLeagueLabels';
	import { statusBadgeColor } from '$lib/utils/statusStyles';

	let {
		status,
		label,
		class: className = ''
	}: { status: string; label?: string; class?: string } = $props();
</script>

<Badge color={statusBadgeColor(status)} class={className}>
	{label ?? tieStatusLabel(status)}
</Badge>
