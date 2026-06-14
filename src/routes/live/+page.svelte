<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import AppSwitch from '$lib/components/AppSwitch.svelte';
	import LiveActiveTies from './LiveActiveTies.svelte';
	import LiveStandings from './LiveStandings.svelte';
	import LiveFinalsBoard from './LiveFinalsBoard.svelte';
	import LiveSchedule from './LiveSchedule.svelte';
	import {
		getActiveTies,
		getGroupStandings,
		getFinalsBoard,
		getSchedule,
		getScoreProgression
	} from './live.remote';

	let realtimeEnabled = $state(true);

	const activeTies = getActiveTies();
	const standings = getGroupStandings();
	const finalsBoard = getFinalsBoard();
	const schedule = getSchedule();
	const progression = getScoreProgression();

	function refreshAll() {
		activeTies.refresh();
		standings.refresh();
		finalsBoard.refresh();
		schedule.refresh();
		progression.refresh();
	}

	$effect(() => {
		if (!realtimeEnabled) return;
		const id = setInterval(refreshAll, 8000);
		function onVisibilityChange() {
			if (document.visibilityState === 'visible') refreshAll();
		}
		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => {
			clearInterval(id);
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	});
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
		<AppSwitch bind:checked={realtimeEnabled} label="自動更新" />
	</div>
{/snippet}

<PageHeader title="ライブ表示" actions={headerActions} />

<LiveActiveTies query={activeTies} progressionQuery={progression} />
<LiveStandings query={standings} />
<LiveFinalsBoard query={finalsBoard} />
<LiveSchedule query={schedule} />
