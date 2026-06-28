<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import RealtimeSync from '$lib/components/RealtimeSync.svelte';
	import LiveStandings from '../../LiveStandings.svelte';
	import { createRealtimeQueryFlow } from '$lib/realtime/queryFlow';
	import type { RealtimeUpdate } from '$lib/realtime/updates';
	import { getStandingsPageData } from './standings.remote';

	const standingsQuery = getStandingsPageData();
	let standings = $derived({ current: standingsQuery.current ?? null });

	const refreshTopics = createRealtimeQueryFlow({
		refresh: () => standingsQuery.refresh(),
		shouldRefresh: (update: RealtimeUpdate) => update.topics.includes('standings')
	});
</script>

<svelte:head>
	<title>順位表 | 東大リーグ団体戦</title>
</svelte:head>

{#snippet headerActions()}
	<RealtimeSync
		topics={['standings'] as const}
		onUpdate={(u) => void refreshTopics(u)}
		pollInterval={30000}
	/>
{/snippet}

<PageHeader title="ライブ表示" actions={headerActions} />

<LiveStandings query={standings} />
