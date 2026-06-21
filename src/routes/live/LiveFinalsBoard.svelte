<script lang="ts">
	import { phaseLabel, tieStatusLabel } from '$lib/domain/tokyoLeagueLabels';
	import Card from '$lib/components/Card.svelte';
	import type { LivePageData } from '$lib/server/services/livePageService';
	import type { QueryValue } from '$lib/utils/types';
	import SectionLabel from '$lib/components/SectionLabel.svelte';
	import { cn } from '$lib/utils/cn';

	let { query }: { query: QueryValue<LivePageData['finalsBoard']> } = $props();
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
{:else if query.current.finalsBoard.length > 0}
	<section class="space-y-3">
		<SectionLabel>決勝トーナメント</SectionLabel>
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each query.current.finalsBoard as tie (tie.id)}
				<Card class={cn(tie.status === 'playing' ? 'border-emerald-200' : '')} flush>
					<div class="p-4">
						<p class="text-xs font-medium text-muted">{phaseLabel(tie.phase)}</p>
						<div class="mt-1.5 flex items-baseline justify-between gap-2">
							<p class="min-w-0 truncate text-sm font-semibold">
								{tie.teamAName ?? '未定'} vs {tie.teamBName ?? '未定'}
							</p>
							<span
								class="shrink-0 text-lg font-bold tabular-nums {tie.status === 'playing'
									? 'text-emerald-700'
									: ''}"
							>
								{tie.teamScoreA}–{tie.teamScoreB}
							</span>
						</div>
						<p class="mt-0.5 text-xs text-muted">{tieStatusLabel(tie.status)}</p>
					</div>
				</Card>
			{/each}
		</div>
	</section>
{/if}
