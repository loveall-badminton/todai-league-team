<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import { phaseLabel, tieStatusLabel } from '$lib/domain/tokyoLeagueLabels';
	import type { LivePageData } from '$lib/server/services/livePageService';
	import type { QueryValue } from '$lib/utils/types';
	import { groupTiesByPhase, statusDot, statusText } from './scheduleHelpers';
	import SectionLabel from '$lib/components/SectionLabel.svelte';
	import { resolve } from '$app/paths';
	import { Clock, ArrowRight, CircleCheck, CircleAlert } from '@lucide/svelte';
	import { goto } from '$app/navigation';

	type ScheduleTie = NonNullable<LivePageData['schedule']>[number];

	let {
		query,
		myTeamId = null
	}: { query: QueryValue<LivePageData['schedule']>; myTeamId?: string | null } = $props();

	let grouped = $derived(
		query.current == null ? null : groupTiesByPhase<ScheduleTie>(query.current)
	);

	function isMyTie(tie: ScheduleTie): boolean {
		if (!myTeamId) return false;
		return tie.teamAId === myTeamId || tie.teamBId === myTeamId;
	}

	function showDeadline(tie: ScheduleTie): boolean {
		return (
			!!tie.lineupDueAt && (tie.status === 'lineup_pending' || tie.status === 'lineup_submitted')
		);
	}
</script>

{#if query.current == null}
	<!-- skeleton -->
	<section class="space-y-3">
		<div class="h-3 w-20 animate-pulse rounded-full bg-zinc-200"></div>
		<Card class="divide-y divide-zinc-100 overflow-hidden">
			{#each [0, 1, 2, 3] as i (i)}
				<div class="flex animate-pulse items-center gap-3 px-4 py-3">
					<div class="h-2 w-2 shrink-0 rounded-full bg-zinc-200"></div>
					<div class="h-3 rounded-full bg-zinc-200" style="width: {50 + i * 10}%"></div>
					<div class="ml-auto h-3 w-10 rounded-full bg-zinc-200"></div>
				</div>
			{/each}
		</Card>
	</section>
{:else if (grouped?.length ?? 0) > 0}
	<section class="space-y-3">
		<SectionLabel>進行予定表</SectionLabel>
		<div class="space-y-4">
			{#each grouped! as group (group.phase)}
				<Card class="overflow-hidden" flush>
					{#snippet header()}
						<h3 class="text-xs font-semibold tracking-wide text-muted-foreground">
							{phaseLabel(group.phase)}
						</h3>
					{/snippet}
					<div class="divide-y divide-zinc-50">
						{#each group.ties as tie (tie.id)}
							{@const myTie = isMyTie(tie)}
							{@const needsDeadline = showDeadline(tie)}
							{@const lineupSubmitted = tie.status === 'lineup_submitted'}
							<a
								href={resolve('/live/ties/[tieId]', { tieId: tie.id })}
								data-sveltekit-preload-data="tap"
								class="relative flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50 active:bg-zinc-100
									{myTie ? 'bg-blue-50/60' : ''}"
							>
								{#if myTie}
									<span class="absolute inset-y-0 left-0 w-0.5 rounded-full bg-blue-400"></span>
								{/if}
								<span class="mt-0.5 h-2 w-2 shrink-0 rounded-full {statusDot(tie.status)}"></span>
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
										{#if tie.scheduledStartAt}
											<span
												class="inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums
													{myTie ? 'text-blue-600' : 'text-zinc-500'}"
											>
												<Clock class="size-3 shrink-0" />
												{tie.scheduledStartAt}
											</span>
										{/if}
									</div>
									<p
										class="truncate text-sm font-medium {myTie ? 'text-zinc-900' : 'text-zinc-700'}"
									>
										{tie.teamAName ?? '未定'} vs {tie.teamBName ?? '未定'}
									</p>
									{#if needsDeadline && myTie}
										<div class="mt-0.5 flex flex-wrap items-center gap-2">
											<p
												class="inline-flex items-center gap-1 text-[11px] font-medium
													{lineupSubmitted ? 'text-emerald-600' : 'text-amber-600'}"
											>
												{#if lineupSubmitted}
													<CircleCheck class="size-3 shrink-0" />
													提出済
												{:else}
													<CircleAlert class="size-3 shrink-0" />
													オーダーは{tie.lineupDueAt}までに提出
												{/if}
											</p>
											{#if myTie && myTeamId && !lineupSubmitted}
												<button
													type="button"
													onclick={(e) => {
														e.preventDefault();
														void goto(
															resolve('/ties/[tieId]/lineups/[teamId]', {
																tieId: tie.id,
																teamId: myTeamId!
															})
														);
													}}
													class="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-200"
												>
													<ArrowRight class="size-3 shrink-0" /> 提出する
												</button>
											{/if}
										</div>
									{/if}
								</div>
								{#if ['playing', 'interval', 'suspended', 'finished', 'confirmed'].includes(tie.status)}
									<span
										class="shrink-0 text-sm font-bold tabular-nums {tie.status === 'playing'
											? 'text-emerald-700'
											: 'text-muted-emphasis'}"
									>
										{tie.teamScoreA}–{tie.teamScoreB}
									</span>
								{/if}
								<span class="shrink-0 text-xs {statusText(tie.status)}">
									{tieStatusLabel(tie.status)}
								</span>
							</a>
						{/each}
					</div>
				</Card>
			{/each}
		</div>
	</section>
{/if}
