<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import { phaseLabel, tieStatusLabel } from '$lib/domain/tokyoLeagueLabels';
	import type { getSchedule } from './live.remote';

	let { query }: { query: ReturnType<typeof getSchedule> } = $props();

	function formatTime(val: string | null | undefined): string | null {
		return val || null;
	}

	function statusDot(status: string): string {
		if (status === 'playing') return 'bg-emerald-500 animate-pulse';
		if (['finished', 'confirmed'].includes(status)) return 'bg-zinc-300';
		if (['forfeited', 'cancelled'].includes(status)) return 'bg-red-300';
		return 'bg-amber-400';
	}

	function statusText(status: string): string {
		if (status === 'playing') return 'text-emerald-700 font-medium';
		if (['finished', 'confirmed'].includes(status)) return 'text-zinc-400';
		return 'text-zinc-500';
	}

	// Group ties by phase in displayOrder
	type Tie = NonNullable<typeof query.current>[number];
	let grouped = $derived(
		query.current == null
			? null
			: query.current.reduce<{ phase: string; ties: Tie[] }[]>((acc, tie) => {
					const group = acc.find((g) => g.phase === tie.phase);
					if (group) group.ties.push(tie);
					else acc.push({ phase: tie.phase, ties: [tie] });
					return acc;
				}, [])
	);
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
		<h2 class="text-xs font-semibold tracking-wider text-zinc-400">進行予定表</h2>
		<div class="space-y-4">
			{#each grouped! as group (group.phase)}
				<Card class="overflow-hidden">
					<div class="border-b border-zinc-100 px-4 py-2.5">
						<h3 class="text-xs font-semibold tracking-wide text-zinc-500">
							{phaseLabel(group.phase)}
						</h3>
					</div>
					<div class="divide-y divide-zinc-50">
						{#each group.ties as tie (tie.id)}
							{@const timeStr = formatTime(tie.scheduledStartAt)}
							<div class="flex items-center gap-3 px-4 py-2.5">
								<span class="mt-0.5 h-2 w-2 shrink-0 rounded-full {statusDot(tie.status)}"></span>
								<div class="min-w-0 flex-1">
									{#if timeStr}
										<p class="text-[10px] font-medium text-zinc-400 tabular-nums">{timeStr}</p>
									{/if}
									<p class="truncate text-sm font-medium text-zinc-900">
										{tie.teamAName ?? '未定'} vs {tie.teamBName ?? '未定'}
									</p>
								</div>
								{#if ['playing', 'interval', 'suspended', 'finished', 'confirmed'].includes(tie.status)}
									<span
										class="shrink-0 text-sm font-bold tabular-nums {tie.status === 'playing'
											? 'text-emerald-700'
											: 'text-zinc-600'}"
									>
										{tie.teamScoreA}–{tie.teamScoreB}
									</span>
								{/if}
								<span class="shrink-0 text-xs {statusText(tie.status)}">
									{tieStatusLabel(tie.status)}
								</span>
							</div>
						{/each}
					</div>
				</Card>
			{/each}
		</div>
	</section>
{/if}
