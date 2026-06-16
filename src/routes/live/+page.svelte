<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import RealtimeSync from '$lib/components/RealtimeSync.svelte';
	import LiveActiveTies from './LiveActiveTies.svelte';
	import LiveStandings from './LiveStandings.svelte';
	import LiveFinalsBoard from './LiveFinalsBoard.svelte';
	import LiveSchedule from './LiveSchedule.svelte';
	import { ALL_LIVE_TOPICS, type LiveTopic } from '$lib/realtime/channels';
	import { getLivePageData } from './live.remote';

	const liveQuery = getLivePageData();
	let liveData = $derived(await liveQuery);
	let activeTies = $derived({ current: liveData.activeTies });
	let standings = $derived({ current: liveData.standings });
	let finalsBoard = $derived({ current: liveData.finalsBoard });
	let schedule = $derived({ current: liveData.schedule });
	let progression = $derived({ current: liveData.progression });

	function refreshTopics(topics: LiveTopic[]) {
		if (topics.length > 0) void liveQuery.refresh();
	}
</script>

<svelte:head>
	<title>ライブ | 東大リーグ団体戦</title>
</svelte:head>

{#snippet headerActions()}
	<div class="flex items-center gap-3">
		<div class="flex items-center gap-2 text-xs text-zinc-400">
			<span class="flex items-center gap-1.5">
				<span class="relative flex size-2">
					{#if (activeTies.current?.ties.length ?? 0) > 0}
						<span
							class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
						></span>
					{/if}
					<span
						class="relative inline-flex size-2 rounded-full {(activeTies.current?.ties.length ??
							0) > 0
							? 'bg-emerald-500'
							: 'bg-zinc-300'}"
					></span>
				</span>
				{(activeTies.current?.ties.length ?? 0) > 0
					? `${activeTies.current!.ties.length}試合進行中`
					: '進行中の試合なし'}
			</span>
		</div>
		<RealtimeSync topics={ALL_LIVE_TOPICS} onUpdate={refreshTopics} pollInterval={8000} />
	</div>
{/snippet}

<PageHeader title="ライブ表示" actions={headerActions} />

<LiveActiveTies query={activeTies} progressionQuery={progression} />
<LiveStandings query={standings} />
<LiveFinalsBoard query={finalsBoard} />
<LiveSchedule query={schedule} />
