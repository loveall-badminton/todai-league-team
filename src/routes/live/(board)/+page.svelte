<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import RealtimeSync from '$lib/components/RealtimeSync.svelte';
	import LiveSchedule from '../LiveSchedule.svelte';
	import { getSchedulePageData } from './live.remote';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Card from '$lib/components/Card.svelte';
	import SectionLabel from '$lib/components/SectionLabel.svelte';
	import { ArrowRight } from '@lucide/svelte';
	import { PatchCollection } from '$lib/optimistic';
	import type { RealtimeUpdate } from '$lib/realtime/updates';

	const scheduleQuery = getSchedulePageData();
	let myTeamId = $derived(page.data.authProfile?.teamId ?? null);
	const schedulePatches = new PatchCollection({
		getServerItems: () => scheduleQuery.current ?? [],
		getId: (tie) => tie.id
	});
	let scheduleRows = $derived(schedulePatches.items);
	let schedule = $derived({ current: scheduleQuery.current ? scheduleRows : null });

	let playingTies = $derived(scheduleRows.filter((t) => t.status === 'playing'));
	let playingCount = $derived(playingTies.length);

	async function refreshSchedule() {
		const snapshot = schedulePatches.snapshot();
		await scheduleQuery.refresh();
		schedulePatches.invalidateStale(snapshot);
	}

	function applyScheduleUpdate(
		update: RealtimeUpdate<'schedule'>
	): 'applied' | 'refresh' | 'ignore' {
		if (update.source === 'poll') return 'refresh';
		if (!update.topics.includes('schedule')) return 'ignore';
		const ties = update.data?.schedule?.ties;
		if (!ties?.length) return 'refresh';
		for (const tie of ties) {
			const patch = schedulePatches.get(tie.id);
			const base = scheduleQuery.current?.find((row) => row.id === tie.id);
			const updatedAt = patch?.updatedAt ?? base?.updatedAt;
			if (updatedAt && Date.parse(tie.updatedAt) < Date.parse(updatedAt)) continue;
			schedulePatches.apply(tie.id, tie);
		}
		return 'applied';
	}
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
			topics={['schedule']}
			refresh={refreshSchedule}
			applyUpdate={applyScheduleUpdate}
			pollInterval={15000}
		/>
	</div>
{/snippet}

<PageHeader title="ライブ表示" actions={headerActions} />

<div class="space-y-3" style="view-transition-name: live-tab-content">
	{#if playingTies.length > 0}
		<section class="space-y-3">
			<SectionLabel>進行中</SectionLabel>
			<Card flush class="overflow-hidden">
				<div class="divide-y divide-zinc-50">
					{#each playingTies as tie (tie.id)}
						<a
							href={resolve('/live/ties/[tieId]', { tieId: tie.id })}
							data-sveltekit-preload-data="tap"
							class="flex min-h-13 items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 active:bg-zinc-100"
							style="view-transition-name: tie-card-{tie.id}"
						>
							<span class="relative flex size-2 shrink-0">
								<span
									class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
								></span>
								<span class="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
							</span>
							<div class="min-w-0 flex-1">
								<p class="text-[11px] font-semibold text-zinc-500">{tie.tieCode}</p>
								<p class="truncate text-sm font-semibold text-zinc-900">
									{tie.teamAName ?? '未定'} vs {tie.teamBName ?? '未定'}
								</p>
							</div>
							<span class="shrink-0 text-base font-bold tabular-nums text-emerald-700">
								{tie.teamScoreA}–{tie.teamScoreB}
							</span>
							<ArrowRight class="size-4 shrink-0 text-zinc-300" />
						</a>
					{/each}
				</div>
			</Card>
		</section>
	{/if}

	<LiveSchedule query={schedule} {myTeamId} />
</div>
