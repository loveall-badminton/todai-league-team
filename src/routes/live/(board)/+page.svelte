<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import RealtimeSync from '$lib/components/RealtimeSync.svelte';
	import LiveSchedule from '../LiveSchedule.svelte';
	import { createRealtimeQueryFlow } from '$lib/realtime/queryFlow';
	import type { RealtimeUpdate } from '$lib/realtime/updates';
	import { getSchedulePageData } from './live.remote';

	const scheduleQuery = getSchedulePageData();
	// Use .current (sync reactive getter) instead of await to avoid component suspension
	let schedule = $derived({ current: scheduleQuery.current ?? null });
	let playingCount = $derived(
		scheduleQuery.current?.filter((t) => t.status === 'playing').length ?? 0
	);

	const refreshTopics = createRealtimeQueryFlow({
		refresh: () => scheduleQuery.refresh(),
		shouldRefresh: (update: RealtimeUpdate) => update.topics.includes('schedule')
	});
</script>

<svelte:head>
	<title>進行表 | 東大リーグ団体戦</title>
</svelte:head>

{#snippet headerActions()}
	<div class="flex items-center gap-3">
		<span class="flex items-center gap-1.5 text-xs text-muted">
			<span class="relative flex size-2">
				{#if playingCount > 0}
					<span
						class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
					></span>
				{/if}
				<span
					class="relative inline-flex size-2 rounded-full {playingCount > 0
						? 'bg-emerald-500'
						: 'bg-zinc-300'}"
				></span>
			</span>
			{playingCount > 0 ? `${playingCount}試合進行中` : '進行中の試合なし'}
		</span>
		<RealtimeSync
			topics={['schedule'] as const}
			onUpdate={(u) => void refreshTopics(u)}
			pollInterval={15000}
		/>
	</div>
{/snippet}

<PageHeader title="ライブ表示" actions={headerActions} />

<LiveSchedule query={schedule} />
