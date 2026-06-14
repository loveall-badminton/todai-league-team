<script lang="ts">
	import { resolve } from '$app/paths';
	import { phaseLabel, tieStatusLabel } from '$lib/domain/tokyoLeagueLabels';
	import { Trophy } from '@lucide/svelte';
	import AppButton from '$lib/components/AppButton.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { toast } from 'svelte-sonner';
	import { generateSemifinals, generateFinals, getFinalsData } from './finals.remote';

	const finalsData = getFinalsData();

	const orderedCodes = ['x-1', 'x-2', 'x-3', 'x-4', 'x-5'];
	let orderedTies = $derived(
		orderedCodes
			.map((code) => finalsData.current?.ties.find((tie) => tie.tieCode === code))
			.filter((tie) => !!tie)
	);

	let semifinalsCanGenerate = $derived(finalsData.current?.groupStandingsReady ?? false);
	let semifinalsHint = $derived.by(() => {
		if (!finalsData.current) return null;
		const { groupAAllDone, groupBAllDone, noTiebreakerA, noTiebreakerB } = finalsData.current;
		if (!groupAAllDone || !groupBAllDone) {
			const incomplete = [!groupAAllDone && 'Aリーグ', !groupBAllDone && 'Bリーグ']
				.filter(Boolean)
				.join('・');
			return `${incomplete}の試合が全て完了してから生成できます`;
		}
		if (!noTiebreakerA || !noTiebreakerB) return '同点チームの順位を確定してから生成できます';
		return null;
	});

	let finalsCanGenerate = $derived.by(() => {
		const semi1 = orderedTies.find((t) => t.tieCode === 'x-1');
		const semi2 = orderedTies.find((t) => t.tieCode === 'x-2');
		const done = (t: typeof semi1) => t?.status === 'finished' || t?.status === 'confirmed';
		return !!semi1 && !!semi2 && done(semi1) && done(semi2);
	});
	let finalsHint = $derived.by(() => {
		const semi1 = orderedTies.find((t) => t.tieCode === 'x-1');
		const semi2 = orderedTies.find((t) => t.tieCode === 'x-2');
		if (!semi1 || !semi2) return '先に準決勝・5位決定戦を生成してください';
		const done = (t: typeof semi1) => t?.status === 'finished' || t?.status === 'confirmed';
		if (!done(semi1) || !done(semi2)) return '準決勝1・準決勝2の結果確定後に生成できます';
		return null;
	});
</script>

<svelte:head>
	<title>決勝トーナメント | 東大リーグ団体戦</title>
</svelte:head>

{#snippet headerActions()}
	<div class="flex flex-col items-end gap-2">
		<div class="flex gap-2">
			<AppButton
				variant="secondary"
				disabled={!semifinalsCanGenerate}
				onclick={async () => {
					try {
						const r = await generateSemifinals();
						await finalsData.refresh();
						if (r?.message) toast.success(r.message);
					} catch (e) {
						toast.error(e instanceof Error ? e.message : '失敗');
					}
				}}
			>
				準決勝・5位決定戦生成
			</AppButton>
			<AppButton
				disabled={!finalsCanGenerate}
				onclick={async () => {
					try {
						const r = await generateFinals();
						await finalsData.refresh();
						if (r?.message) toast.success(r.message);
					} catch (e) {
						toast.error(e instanceof Error ? e.message : '失敗');
					}
				}}
			>
				決勝・3位決定戦生成
			</AppButton>
		</div>
		{#if semifinalsHint || finalsHint}
			<p class="text-xs text-zinc-400">
				{semifinalsHint ?? finalsHint}
			</p>
		{/if}
	</div>
{/snippet}

<PageHeader title="決勝トーナメント" actions={headerActions} />

{#if finalsData.current === null}
	<div class="grid gap-2 sm:grid-cols-2">
		{#each [0, 1, 2, 3, 4] as i (i)}
			<div class="animate-pulse rounded-xl border border-zinc-100 bg-white p-4 space-y-2">
				<div class="h-2.5 w-24 rounded-full bg-zinc-200"></div>
				<div class="flex items-center justify-between gap-2">
					<div class="h-4 w-36 rounded-full bg-zinc-200"></div>
					<div class="h-6 w-10 rounded-lg bg-zinc-200"></div>
				</div>
				<div class="h-2.5 w-16 rounded-full bg-zinc-200"></div>
			</div>
		{/each}
	</div>
{:else if orderedTies.length === 0}
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
