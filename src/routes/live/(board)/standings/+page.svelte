<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import RealtimeSync from '$lib/components/RealtimeSync.svelte';
	import LiveStandings from '../../LiveStandings.svelte';
	import { getStandingsPageData } from './standings.remote';

	const standingsQuery = getStandingsPageData();
	let standings = $derived({ current: standingsQuery.current ?? null });
</script>

<svelte:head>
	<title>順位表 | 東大リーグ団体戦</title>
</svelte:head>

{#snippet headerActions()}
	<RealtimeSync
		topics={['standings']}
		refresh={() => standingsQuery.refresh()}
		shouldRefresh={(update) => update.topics.includes('standings')}
		pollInterval={30000}
	/>
{/snippet}

<PageHeader title="ライブ表示" actions={headerActions} />

<div>
	<LiveStandings query={standings} />
</div>
