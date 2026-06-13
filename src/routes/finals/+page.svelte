<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { phaseLabel, tieStatusLabel } from '$lib/domain/tokyoLeagueLabels';
	import { Trophy } from '@lucide/svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import type { PageProps } from './$types';
	import { generateSemifinals, generateFinals } from './finals.remote';

	let { data }: PageProps = $props();

	let cmdMessage = $state<string | null>(null);
	let cmdError = $state<string | null>(null);

	const orderedCodes = ['x-1', 'x-2', 'x-3', 'x-4', 'x-5'];
	let orderedTies = $derived(
		orderedCodes.map((code) => data.ties.find((tie) => tie.tieCode === code)).filter((tie) => !!tie)
	);
</script>

<svelte:head>
	<title>決勝トーナメント | 東大リーグ団体戦</title>
</svelte:head>

{#snippet headerActions()}
	<div class="flex gap-2">
		<button
			class="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
			onclick={async () => {
				cmdMessage = null;
				cmdError = null;
				try {
					const r = await generateSemifinals();
					await invalidateAll();
					cmdMessage = r?.message ?? null;
				} catch (e) {
					cmdError = e instanceof Error ? e.message : '失敗';
				}
			}}
		>
			準決勝・5位決定戦生成
		</button>
		<button
			class="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
			onclick={async () => {
				cmdMessage = null;
				cmdError = null;
				try {
					const r = await generateFinals();
					await invalidateAll();
					cmdMessage = r?.message ?? null;
				} catch (e) {
					cmdError = e instanceof Error ? e.message : '失敗';
				}
			}}
		>
			決勝・3位決定戦生成
		</button>
	</div>
{/snippet}

<PageHeader title="決勝トーナメント" actions={headerActions} />

{#if cmdMessage}
	<div class="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
		{cmdMessage}
	</div>
{/if}
{#if cmdError}
	<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
		{cmdError}
	</div>
{/if}

{#if orderedTies.length === 0}
	<EmptyState message="予選順位から準決勝・5位決定戦を生成してください">
		<Trophy class="mx-auto mb-3 h-8 w-8 text-zinc-300" />
	</EmptyState>
{:else}
	{@const semis = orderedTies.filter((t) => t.phase === 'semifinal' || t.phase === 'fifth_place')}
	{@const finals = orderedTies.filter((t) => t.phase === 'final' || t.phase === 'third_place')}

	{#if semis.length > 0}
		<section class="space-y-2">
			<h2 class="text-xs font-semibold tracking-wider text-zinc-500">準決勝 / 5位決定戦</h2>
			<div class="grid gap-2 sm:grid-cols-2">
				{#each semis as tie (tie.id)}
					<a
						href={resolve('/ties/[tieId]', { tieId: tie.id })}
						class="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-400"
					>
						<div class="min-w-0">
							<p class="text-xs text-zinc-500">{phaseLabel(tie.phase)} · {tie.tieCode}</p>
							<p class="mt-0.5 truncate font-medium text-zinc-900">
								{tie.teamAName ?? '未定'} vs {tie.teamBName ?? '未定'}
							</p>
							<p class="text-xs text-zinc-500">{tieStatusLabel(tie.status)}</p>
						</div>
						<div class="ml-4 shrink-0 text-right">
							<p class="text-2xl font-bold text-zinc-950 tabular-nums">
								{tie.teamScoreA}–{tie.teamScoreB}
							</p>
						</div>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	{#if finals.length > 0}
		<section class="space-y-2">
			<h2 class="text-xs font-semibold tracking-wider text-zinc-500">決勝 / 3位決定戦</h2>
			<div class="grid gap-2 sm:grid-cols-2">
				{#each finals as tie (tie.id)}
					<a
						href={resolve('/ties/[tieId]', { tieId: tie.id })}
						class="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-400"
					>
						<div class="min-w-0">
							<p class="text-xs text-zinc-500">{phaseLabel(tie.phase)} · {tie.tieCode}</p>
							<p class="mt-0.5 truncate font-medium text-zinc-900">
								{tie.teamAName ?? '未定'} vs {tie.teamBName ?? '未定'}
							</p>
							<p class="text-xs text-zinc-500">{tieStatusLabel(tie.status)}</p>
						</div>
						<div class="ml-4 shrink-0 text-right">
							<p class="text-2xl font-bold text-zinc-950 tabular-nums">
								{tie.teamScoreA}–{tie.teamScoreB}
							</p>
						</div>
					</a>
				{/each}
			</div>
		</section>
	{/if}
{/if}
