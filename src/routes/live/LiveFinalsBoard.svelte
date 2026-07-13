<script lang="ts">
	import { phaseLabel, tieStatusLabel } from '$lib/domain/tokyoLeagueLabels';
	import Card from '$lib/components/ui/Card.svelte';
	import type { ScheduleData } from '$lib/server/services/livePageService';
	import type { QueryValue } from '$lib/types/ui';
	import SectionLabel from '$lib/components/ui/SectionLabel.svelte';
	import { cn } from '$lib/utils/cn';

	const FINALS_PHASES = new Set([
		'semifinal',
		'final',
		'third_place',
		'fifth_place',
		'ranking_tiebreaker'
	]);

	let { query }: { query: QueryValue<ScheduleData> } = $props();

	let finalsTies = $derived((query.current ?? []).filter((t) => FINALS_PHASES.has(t.phase)));
</script>

{#if query.current == null}
	<section class="space-y-3">
		<div class="h-3 w-28 animate-pulse rounded-full bg-zinc-200"></div>
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each [0, 1, 2] as i (i)}
				<div class="animate-pulse space-y-2 rounded-2xl border border-border-subtle bg-white p-4">
					<div class="h-2.5 w-16 rounded-full bg-zinc-200"></div>
					<div class="flex items-baseline justify-between gap-2">
						<div class="h-4 w-32 rounded-full bg-zinc-200"></div>
						<div class="h-6 w-10 rounded-lg bg-zinc-200"></div>
					</div>
					<div class="h-2.5 w-12 rounded-full bg-zinc-200"></div>
				</div>
			{/each}
		</div>
	</section>
{:else if finalsTies.length > 0}
	<section class="space-y-3">
		<SectionLabel>決勝トーナメント</SectionLabel>
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each finalsTies as tie (tie.id)}
				<Card class={cn(tie.status === 'playing' ? 'border-emerald-200' : '')} flush>
					<div class="p-4">
						<div class="flex items-center gap-1.5">
							<p class="text-xs font-semibold text-muted">{tie.tieCode}</p>
							<span class="text-zinc-200">·</span>
							<p class="text-xs text-muted">{phaseLabel(tie.phase)}</p>
						</div>
						<div class="mt-1.5 flex items-baseline justify-between gap-2">
							<p class="min-w-0 truncate text-sm font-semibold">
								{tie.teamAName ?? '未定'} vs {tie.teamBName ?? '未定'}
							</p>
							{#if ['playing', 'interval', 'suspended', 'finished', 'confirmed'].includes(tie.status)}
								<span
									class={cn(
										'shrink-0 text-lg font-bold tabular-nums',
										tie.status === 'playing' && 'text-emerald-700'
									)}
								>
									{tie.teamScoreA}–{tie.teamScoreB}
								</span>
							{/if}
						</div>
						<p class="mt-0.5 text-xs text-muted">{tieStatusLabel(tie.status)}</p>
					</div>
				</Card>
			{/each}
		</div>
	</section>
{/if}
