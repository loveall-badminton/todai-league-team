<script lang="ts">
	import Badge from './ui/Badge.svelte';
	import { groupBadgeColor } from '$lib/utils/statusStyles';

	let { groupCode }: { groupCode: string | null } = $props();

	let label = $derived(groupCode === 'A' ? 'Aリーグ' : groupCode === 'B' ? 'Bリーグ' : '未割当');
</script>

<Badge color={groupBadgeColor(groupCode)}>
	{label}
</Badge>
