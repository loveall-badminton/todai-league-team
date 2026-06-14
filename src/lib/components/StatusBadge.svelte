<script lang="ts">
	import Badge from './Badge.svelte';
	import { tieStatusLabel } from '$lib/domain/tokyoLeagueLabels';
	import { statusBadgeColor } from '$lib/utils/statusStyles';

	let { status }: { status: string } = $props();
</script>

<Badge color={statusBadgeColor(status)}>
	{tieStatusLabel(status)}
</Badge>
