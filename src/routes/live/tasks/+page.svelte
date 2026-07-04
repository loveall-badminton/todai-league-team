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
	import Card from '$lib/components/Card.svelte';
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

	const { remainingMin } = useLineupClock();

	let pendingLineups = $derived(data.myTies.filter((t) => t.status === 'lineup_pending'));
	let submittedLineups = $derived(
		data.myTies.filter(
			(t) => t.status === 'lineup_submitted' || t.status === 'ready' || t.status === 'playing'
		)
	);
	let otherTies = $derived(
		data.myTies.filter(
			(t) =>
				!pendingLineups.includes(t) && !submittedLineups.includes(t) && t.status !== 'cancelled'
		)
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

			{#if data.myTies.length === 0}
				<p class="text-sm text-muted">提出すべきオーダーはありません</p>
			{:else}
				<div class="space-y-2">
					<!-- Urgent: pending -->
					{#each pendingLineups as tie (tie.id)}
						<div class="overflow-hidden rounded-xl border border-amber-300 bg-amber-50">
							<div class="flex items-start justify-between gap-3 px-4 py-3">
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-1.5">
										<span class="text-sm font-semibold text-zinc-900">{tie.tieCode}</span>
										<span
											class="inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
										>
											未提出
										</span>
									</div>
									<p class="mt-0.5 truncate text-xs text-zinc-600">
										{tie.teamAName ?? '未定'} vs {tie.teamBName ?? '未定'}
									</p>
									<div class="mt-1.5 flex flex-wrap items-center gap-3 text-[11px]">
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
												class="inline-flex items-center gap-1 font-semibold {min !== null &&
												min <= 5
													? 'text-red-700'
													: 'text-amber-700'}"
											>
												<AlarmClock class="size-3 shrink-0" />
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
									<span class="text-sm font-medium text-zinc-800">{tie.tieCode}</span>
									<span
										class="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
									>
										<CheckCircle2 class="size-2.5" />
										{tieStatusLabel(tie.status)}
									</span>
								</div>
								<p class="mt-0.5 truncate text-xs text-zinc-500">
									{tie.teamAName ?? '未定'} vs {tie.teamBName ?? '未定'}
								</p>
								{#if tie.scheduledStartAt}
									<span class="mt-1 inline-flex items-center gap-1 text-[11px] text-zinc-400">
										<Clock class="size-3 shrink-0" />
										{tie.scheduledStartAt}
									</span>
								{/if}
							</div>
							<ArrowRight class="size-4 shrink-0 text-zinc-300" />
						</a>
					{/each}

					<!-- Other statuses (finished/confirmed) -->
					{#each otherTies as tie (tie.id)}
						<a
							href={resolve('/ties/[tieId]/lineups/[teamId]', {
								tieId: tie.id,
								teamId: myTeamId!
							})}
							class="flex items-center justify-between gap-3 rounded-xl border border-border-subtle px-4 py-3 text-muted transition-colors hover:bg-zinc-50"
						>
							<div class="min-w-0 flex-1">
								<span class="text-sm font-medium text-zinc-600">{tie.tieCode}</span>
								<p class="mt-0.5 truncate text-xs text-zinc-400">
									{tie.teamAName ?? '未定'} vs {tie.teamBName ?? '未定'}
								</p>
							</div>
							<span class="shrink-0 text-xs text-zinc-400">{tieStatusLabel(tie.status)}</span>
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

			{#if data.myOfficiatingTies.length === 0}
				<p class="text-sm text-muted">審判担当の対戦はありません</p>
			{:else}
				<div class="space-y-3">
					{#each data.myOfficiatingTies as tie (tie.id)}
						{@const rubbers = data.publicRubbersByTieId[tie.id] ?? []}
						{@const playableRubbers = rubbers.filter((r) => r.matchId)}
						{@const notStarted = [
							'scheduled',
							'lineup_pending',
							'lineup_submitted',
							'ready'
						].includes(tie.status)}
						{@const startMin = notStarted ? remainingMin(tie.scheduledStartAt) : null}
						<Card class="overflow-hidden" flush>
							<div class="border-b border-border-subtle bg-zinc-50/60 px-4 py-3">
								<p class="text-sm font-semibold text-zinc-900">{tie.tieCode}</p>
								<div class="mt-0.5 flex flex-wrap items-center gap-3">
									<p class="text-xs text-zinc-500">
										{tie.teamAName ?? '未定'} vs {tie.teamBName ?? '未定'}
									</p>
									{#if tie.scheduledStartAt}
										<span class="inline-flex items-center gap-1 text-[11px] text-zinc-400">
											<Clock class="size-3 shrink-0" />
											{tie.scheduledStartAt}
										</span>
									{/if}
									{#if startMin !== null && startMin > 0 && startMin <= 120}
										<span
											class="inline-flex items-center gap-1 text-[11px] font-semibold {startMin <=
											10
												? 'text-red-700'
												: 'text-amber-700'}"
										>
											<AlarmClock class="size-3 shrink-0" />
											開始まであと {formatDurationMin(startMin)}
										</span>
									{/if}
								</div>
							</div>
							<div class="divide-y divide-zinc-50">
								{#if playableRubbers.length === 0}
									<p class="px-4 py-3 text-xs text-muted">試合の準備ができるまでお待ちください</p>
								{:else}
									{#each playableRubbers as rubber (rubber.id)}
										{@const isPlaying = rubber.status === 'playing'}
										{@const isDone = ['finished', 'confirmed', 'cancelled'].includes(rubber.status)}
										<a
											href={resolve('/referee/[matchId]', { matchId: rubber.matchId! })}
											data-sveltekit-preload-data="tap"
											class="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50
												{isPlaying ? 'bg-emerald-50/40' : ''}"
										>
											<span
												class="w-10 shrink-0 text-xs font-semibold
													{isPlaying ? 'text-emerald-700' : isDone ? 'text-zinc-300' : 'text-zinc-600'}"
											>
												{rubberLabel(rubber.code)}
											</span>
											<span
												class="flex-1 text-xs
													{isPlaying ? 'font-medium text-emerald-600' : isDone ? 'text-zinc-400' : 'text-zinc-500'}"
											>
												{rubberStatusLabel(rubber.status)}
											</span>
											{#if !isDone}
												<ArrowRight
													class="size-3.5 shrink-0 {isPlaying
														? 'text-emerald-400'
														: 'text-zinc-300'}"
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
