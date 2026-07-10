<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		AlarmClock,
		ArrowRight,
		CheckCircle2,
		Clock,
		Shield,
		ClipboardList
	} from '@lucide/svelte';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppTabs from '$lib/components/AppTabs.svelte';
	import Card from '$lib/components/Card.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import IconMeta from '$lib/components/IconMeta.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import RealtimeSync from '$lib/components/RealtimeSync.svelte';
	import { rubberLabel, rubberStatusLabel, tieStatusLabel } from '$lib/domain/tokyoLeagueLabels';
	import type { PageProps } from './$types';
	import { useLineupClock } from '$lib/utils/lineupCountdown.svelte';
	import { formatDurationMin } from '$lib/utils/timeOfDay';

	let { data }: PageProps = $props();

	let myTeamId = $derived(data.authProfile?.teamId ?? null);
	let isTeamAccount = $derived(data.authProfile?.accountType === 'team' && !!myTeamId);

	const { remainingMin } = useLineupClock(() => data.tournamentDate);

	// null (未定) を最後に回す昇順比較。
	function byTimeAsc<T>(getTime: (item: T) => string | null) {
		return (a: T, b: T) => {
			const ta = getTime(a);
			const tb = getTime(b);
			if (ta === tb) return 0;
			if (ta === null) return 1;
			if (tb === null) return -1;
			return ta < tb ? -1 : 1;
		};
	}

	let pendingLineups = $derived(
		data.myTies
			.filter((t) => t.status === 'lineup_pending')
			.toSorted(byTimeAsc((t) => t.lineupDueAt))
	);
	let submittedLineups = $derived(
		data.myTies
			.filter((t) => t.status === 'lineup_submitted' || t.status === 'playing')
			.toSorted(byTimeAsc((t) => t.scheduledStartAt))
	);
	let otherTies = $derived(
		data.myTies
			.filter(
				(t) =>
					!pendingLineups.includes(t) && !submittedLineups.includes(t) && t.status !== 'cancelled'
			)
			.toSorted(byTimeAsc((t) => t.scheduledStartAt))
	);
	let sortedOfficiatingTies = $derived(
		data.myOfficiatingTies.toSorted(byTimeAsc((t) => t.scheduledStartAt))
	);

	function isRubberDone(status: string) {
		return status === 'finished' || status === 'confirmed' || status === 'cancelled';
	}

	let activeOfficiatingTies = $derived(
		sortedOfficiatingTies.filter((tie) => {
			const playable = (data.publicRubbersByTieId[tie.id] ?? []).filter((r) => r.matchId);
			return playable.length === 0 || !playable.every((r) => isRubberDone(r.status));
		})
	);
	let doneOfficiatingTies = $derived(
		sortedOfficiatingTies.filter((tie) => {
			const playable = (data.publicRubbersByTieId[tie.id] ?? []).filter((r) => r.matchId);
			return playable.length > 0 && playable.every((r) => isRubberDone(r.status));
		})
	);

	let lineupTab: 'pending' | 'done' = $state('pending');
	let officiatingTab: 'pending' | 'done' = $state('pending');
	let officiatingTies = $derived(
		officiatingTab === 'pending' ? activeOfficiatingTies : doneOfficiatingTies
	);
</script>

<svelte:head>
	<title>オーダー/審判 | 東大リーグ団体戦</title>
</svelte:head>

<PageHeader title="オーダー/審判">
	{#snippet actions()}
		{#if isTeamAccount}
			<RealtimeSync
				topics={['score', 'schedule']}
				refresh={() => invalidateAll()}
				shouldRefresh={(update) => update.topics.includes('schedule')}
				debounceMs={0}
			/>
		{/if}
	{/snippet}
</PageHeader>

{#if !isTeamAccount}
	<Card class="p-6">
		<p class="text-sm text-muted-foreground">
			チームアカウントでログインすると、オーダー提出と審判担当が表示されます。
		</p>
	</Card>
{:else}
	<div class="space-y-6">
		<!-- Lineup section -->
		<section class="space-y-3">
			<div class="flex items-center gap-2">
				<ClipboardList class="size-4 text-muted-foreground" />
				<h2 class="text-sm font-semibold text-default">オーダー提出</h2>
			</div>

			<AppTabs
				bind:value={lineupTab}
				items={[
					{ value: 'pending', label: '要対応', count: pendingLineups.length },
					{ value: 'done', label: '終了済み' }
				]}
			/>

			{#if lineupTab === 'pending'}
				{#if pendingLineups.length === 0 && submittedLineups.length === 0}
					<EmptyState message="要対応のオーダーはありません" />
				{:else}
					<div class="space-y-2">
						<!-- Urgent: pending -->
						{#each pendingLineups as tie (tie.id)}
							<div class="overflow-hidden rounded-xl border-2 border-amber-300 bg-amber-50">
								<div class="flex items-start justify-between gap-3 px-4 py-3.5">
									<div class="min-w-0 flex-1">
										<div class="flex flex-wrap items-center gap-1.5">
											<span class="text-base font-bold text-zinc-900">{tie.tieCode}</span>
											<span
												class="inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800"
											>
												未提出
											</span>
										</div>
										<p class="mt-0.5 truncate text-sm text-zinc-600">
											{tie.teamAName ?? '未定'} vs {tie.teamBName ?? '未定'}
										</p>
										<div class="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
											{#if tie.scheduledStartAt}
												<IconMeta
													Icon={Clock}
													label="開始"
													value={tie.scheduledStartAt}
													class="font-medium text-zinc-500"
													iconClass="size-3 shrink-0"
												/>
											{/if}
											{#if tie.lineupDueAt}
												{@const min = remainingMin(tie.lineupDueAt)}
												<span
													class="inline-flex items-center gap-1 font-bold {min !== null && min <= 5
														? 'text-red-700'
														: 'text-amber-700'}"
												>
													<AlarmClock class="size-3.5 shrink-0" />
													{#if min === null}
														期限あり
													{:else if min > 0}
														あと {formatDurationMin(min)}
													{:else}
														期限超過
													{/if}
												</span>
											{/if}
										</div>
									</div>
									<AppButton
										href={resolve('/ties/[tieId]/lineups/[teamId]', {
											tieId: tie.id,
											teamId: myTeamId!
										})}
										variant="primary"
										size="sm"
										class="shrink-0"
									>
										提出する
										<ArrowRight class="size-3" />
									</AppButton>
								</div>
							</div>
						{/each}

						<!-- Submitted / playing -->
						{#each submittedLineups as tie (tie.id)}
							<a
								href={resolve('/ties/[tieId]/lineups/[teamId]', {
									tieId: tie.id,
									teamId: myTeamId!
								})}
								class="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 transition-colors hover:bg-emerald-50"
							>
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-1.5">
										<span class="text-sm font-semibold text-zinc-800">{tie.tieCode}</span>
										<span
											class="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"
										>
											<CheckCircle2 class="size-3" />
											{tieStatusLabel(tie.status)}
										</span>
									</div>
									<p class="mt-0.5 truncate text-sm text-zinc-500">
										{tie.teamAName ?? '未定'} vs {tie.teamBName ?? '未定'}
									</p>
									{#if tie.scheduledStartAt}
										<span class="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
											<Clock class="size-3 shrink-0" />
											{tie.scheduledStartAt}
										</span>
									{/if}
								</div>
								<ArrowRight class="size-4 shrink-0 text-muted" />
							</a>
						{/each}
					</div>
				{/if}
			{:else if otherTies.length === 0}
				<EmptyState message="終了済みのオーダーはありません" />
			{:else}
				<div class="space-y-2">
					{#each otherTies as tie (tie.id)}
						<a
							href={resolve('/ties/[tieId]/lineups/[teamId]', {
								tieId: tie.id,
								teamId: myTeamId!
							})}
							class="flex items-center justify-between gap-3 rounded-xl border border-border-subtle px-4 py-3 transition-colors hover:bg-zinc-50"
						>
							<div class="min-w-0 flex-1">
								<span class="text-sm font-semibold text-zinc-700">{tie.tieCode}</span>
								<p class="mt-0.5 truncate text-sm text-zinc-500">
									{tie.teamAName ?? '未定'} vs {tie.teamBName ?? '未定'}
								</p>
							</div>
							<span class="shrink-0 text-xs font-medium text-zinc-500"
								>{tieStatusLabel(tie.status)}</span
							>
						</a>
					{/each}
				</div>
			{/if}
		</section>

		<!-- Referee section -->
		<section class="space-y-3">
			<div class="flex items-center gap-2">
				<Shield class="size-4 text-muted-foreground" />
				<h2 class="text-sm font-semibold text-default">審判担当</h2>
			</div>

			<AppTabs
				bind:value={officiatingTab}
				items={[
					{ value: 'pending', label: '要対応', count: activeOfficiatingTies.length },
					{ value: 'done', label: '終了済み' }
				]}
			/>

			{#if officiatingTies.length === 0}
				<EmptyState
					message={officiatingTab === 'pending'
						? '要対応の審判担当はありません'
						: '終了済みの審判担当はありません'}
				/>
			{:else}
				<div class="space-y-3">
					{#each officiatingTies as tie (tie.id)}
						{@const rubbers = data.publicRubbersByTieId[tie.id] ?? []}
						{@const playableRubbers = rubbers.filter((r) => r.matchId)}
						{@const hasPlayingRubber = playableRubbers.some((r) => r.status === 'playing')}
						{@const notStarted = ['scheduled', 'lineup_pending', 'lineup_submitted'].includes(
							tie.status
						)}
						{@const startMin = notStarted ? remainingMin(tie.scheduledStartAt) : null}
						<Card class="overflow-hidden {hasPlayingRubber ? 'border-emerald-300' : ''}" flush>
							<div
								class="border-b border-border-subtle px-4 py-3 {hasPlayingRubber
									? 'bg-emerald-50/60'
									: 'bg-zinc-50/60'}"
							>
								<div class="flex flex-wrap items-center gap-1.5">
									<p class="text-base font-bold text-zinc-900">{tie.tieCode}</p>
									{#if hasPlayingRubber}
										<span
											class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"
										>
											進行中
										</span>
									{/if}
								</div>
								<div class="mt-0.5 flex flex-wrap items-center gap-3">
									<p class="text-sm text-zinc-500">
										{tie.teamAName ?? '未定'} vs {tie.teamBName ?? '未定'}
									</p>
									{#if tie.scheduledStartAt}
										<span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
											<Clock class="size-3 shrink-0" />
											{tie.scheduledStartAt}
										</span>
									{/if}
									{#if startMin !== null && startMin > 0 && startMin <= 120}
										<span
											class="inline-flex items-center gap-1 text-xs font-bold {startMin <= 10
												? 'text-red-700'
												: 'text-amber-700'}"
										>
											<AlarmClock class="size-3.5 shrink-0" />
											開始まであと {formatDurationMin(startMin)}
										</span>
									{/if}
								</div>
							</div>
							<div class="divide-y divide-zinc-50">
								{#if playableRubbers.length === 0}
									<p class="px-4 py-3 text-sm text-muted-foreground">
										試合の準備ができるまでお待ちください
									</p>
								{:else}
									{#each playableRubbers as rubber (rubber.id)}
										{@const isPlaying = rubber.status === 'playing'}
										{@const isDone = ['finished', 'confirmed', 'cancelled'].includes(rubber.status)}
										<a
											href={resolve('/referee/[matchId]', { matchId: rubber.matchId! })}
											data-sveltekit-preload-data="tap"
											class="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-zinc-50
												{isPlaying ? 'bg-emerald-50/40' : isDone ? 'bg-zinc-50' : ''}"
										>
											<span
												class="w-24 shrink-0 text-sm font-semibold
													{isPlaying ? 'text-emerald-700' : isDone ? 'text-zinc-500' : 'text-zinc-600'}"
											>
												{rubberLabel(rubber.code)}
											</span>
											<span
												class="flex-1 text-sm
													{isPlaying ? 'font-medium text-emerald-600' : isDone ? 'text-zinc-600' : 'text-zinc-500'}"
											>
												{rubberStatusLabel(rubber.status)}
											</span>
											{#if !isDone}
												<ArrowRight
													class="size-3.5 shrink-0 {isPlaying ? 'text-emerald-500' : 'text-muted'}"
												/>
											{/if}
										</a>
									{/each}
								{/if}
							</div>
						</Card>
					{/each}
				</div>
			{/if}
		</section>
	</div>
{/if}
