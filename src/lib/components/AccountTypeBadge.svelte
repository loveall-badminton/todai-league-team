<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import Badge from './ui/Badge.svelte';

	let { accountType }: { accountType: string } = $props();

	let color: ComponentProps<typeof Badge>['color'] = $derived(
		accountType === 'admin' ? 'red' : accountType === 'team' ? 'blue' : 'zinc'
	);
	let label = $derived(
		accountType === 'admin' ? '運営' : accountType === 'team' ? 'チーム' : '参加者'
	);
</script>

<Badge {color}>
	{label}
</Badge>
