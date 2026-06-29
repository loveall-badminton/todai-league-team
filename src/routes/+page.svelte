<script lang="ts">
	import { resolve } from '$app/paths';
	import { phaseLabel } from '$lib/domain/tokyoLeagueLabels';
	import AppButton from '$lib/components/AppButton.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Card from '$lib/components/Card.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { ArrowRight, Settings } from '@lucide/svelte';
	import RealtimeSync from '$lib/components/RealtimeSync.svelte';
	import { createRealtimeQueryFlow } from '$lib/realtime/queryFlow';
	import {
		shouldRefreshDashboardPlaying,
		shouldRefreshDashboardRecent,
		type RealtimeUpdate
	} from '$lib/realtime/updates';
	import { getDashboardPlayingTies, getDashboardRecentTies } from './dashboard.remote';

	const playingQuery = getDashboardPlayingTies();
	const recentTiesQuery = getDashboardRecentTies();
	let [playing, recentTies] = $derived(await Promise.all([playingQuery, recentTiesQuery]));

	const handlePlayingUpdate = createRealtimeQueryFlow({
		refresh: () => playingQuery.refresh(),
		shouldRefresh: (update: RealtimeUpdate) => shouldRefreshDashboardPlaying(update)
	});

	const handleRecentTiesUpdate = createRealtimeQueryFlow({
		refresh: () => recentTiesQuery.refresh(),
		shouldRefresh: (update: RealtimeUpdate) => shouldRefreshDashboardRecent(update)
	});
</script>

<svelte:head>
	<title>東大リーグ団体戦</title>
</svelte:head>

{#snippet headerActions()}
	<div class="flex items-center gap-3">
		<RealtimeSync
			topics={['score', 'schedule']}
			onUpdate={(u) => {
				void handlePlayingUpdate(u);
				void handleRecentTiesUpdate(u);
			}}
		/>
		<AppButton variant="secondary" href={resolve('/settings')}>
			<Settings class="h-4 w-4" />
			設定
		</AppButton>
	</div>
{/snippet}

<PageHeader title="運営ホーム" actions={headerActions} />
<!-- Playing ties -->
<Card>
	<div class="mb-3 flex items-center justify-between">
		<h2 class="text-base font-semibold text-default">進行中の対戦</h2>
		<Badge color="emerald">{playing.length}</Badge>
	</div>
	<div class="space-y-2">
		{#each playing as tie (tie.id)}
			<a
				href={resolve('/ties/[tieId]', { tieId: tie.id })}
				data-sveltekit-preload-data="tap"
				class="flex items-center justify-between rounded-xl border border-border p-3 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
			>
				<div class="min-w-0">
					<p class="text-sm font-semibold text-default">{tie.tieCode}</p>
					<p class="truncate text-xs text-muted-foreground">
						{tie.teamAName ?? '未定'} vs {tie.teamBName ?? '未定'}
					</p>
				</div>
				<StatusBadge status={tie.status} />
			</a>
		{:else}
			<div class="rounded-xl border border-dashed border-border p-6 text-center">
				<p class="text-sm text-muted">進行中の対戦はありません</p>
			</div>
		{/each}
	</div>
</Card>

<!-- Recent ties list -->
<Card flush>
	{#snippet header()}
		<h2 class="text-base font-semibold text-default">団体戦カード</h2>
		<a href={resolve('/ties')} class="text-xs font-medium text-muted-foreground hover:text-default">
			すべて見る <ArrowRight class="inline size-3" />
		</a>
	{/snippet}
	<div class="divide-y divide-zinc-100">
		{#each recentTies as tie (tie.id)}
			<a
				href={resolve('/ties/[tieId]', { tieId: tie.id })}
				data-sveltekit-preload-data="tap"
				class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50"
			>
				<div class="w-16 flex-none">
					<span class="text-sm font-semibold text-default">{tie.tieCode}</span>
				</div>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm text-zinc-700">
						{tie.teamAName ?? '未定'} <span class="text-muted">vs</span>
						{tie.teamBName ?? '未定'}
					</p>
					<p class="text-xs text-muted">{phaseLabel(tie.phase)}</p>
				</div>
				<StatusBadge status={tie.status} />
			</a>
		{:else}
			<div class="px-4 py-8 text-center">
				<p class="text-sm text-muted">対戦はまだありません</p>
			</div>
		{/each}
	</div>
</Card>
