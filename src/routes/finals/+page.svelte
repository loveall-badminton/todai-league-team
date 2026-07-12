<script lang="ts">
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import AppSelect from '$lib/components/ui/AppSelect.svelte';
	import AppTabs from '$lib/components/ui/AppTabs.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import SectionLabel from '$lib/components/ui/SectionLabel.svelte';
	import SortableTieItem from '$lib/components/SortableTieItem.svelte';
	import { DragDropProvider } from '@dnd-kit/svelte';
	import { TriangleAlert, Trophy } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import RealtimeSync from '$lib/components/RealtimeSync.svelte';
	import { shouldRefreshFinalsPage } from '$lib/realtime/updates';
	import {
		generateFifthPlace,
		generateFinals,
		generateSemifinals,
		getFinalsData
	} from './finals.remote';
	import {
		canGenerateFifthPlace,
		canGenerateSemifinals,
		canGenerateFinals,
		getFifthPlaceHint,
		getSemifinalsHint
	} from './finalsHelpers';

	const finalsData = getFinalsData();

	const orderedCodes = ['X-1', 'X-2', 'X-3', 'X-4', 'X-5'];
	type SemifinalSelection = {
		x1TeamAId: string;
		x1TeamBId: string;
		x2TeamAId: string;
		x2TeamBId: string;
		x3TeamAId: string;
		x3TeamBId: string;
	};

	let semifinalSelection = $state<SemifinalSelection>({
		x1TeamAId: '',
		x1TeamBId: '',
		x2TeamAId: '',
		x2TeamBId: '',
		x3TeamAId: '',
		x3TeamBId: ''
	});
	let selectionSeedKey = $state('');
	let selectionTab = $state<'semifinal' | 'fifth_place' | 'final'>('semifinal');

	let orderedTies = $derived(
		orderedCodes
			.map((code) => finalsData.current?.ties.find((tie) => tie.tieCode === code))
			.filter((tie) => !!tie)
	);
	let finalsTeams = $derived(finalsData.current?.teams ?? []);

	function byStandingRank(
		teams: typeof finalsTeams,
		standings: { teamId: string; rank: number | null }[]
	) {
		const rankOf = new Map(standings.map((s) => [s.teamId, s.rank]));
		return [...teams].sort(
			(a, b) => (rankOf.get(a.id) ?? Infinity) - (rankOf.get(b.id) ?? Infinity)
		);
	}

	let teamOptionsA = $derived(
		byStandingRank(
			finalsTeams.filter((team) => team.groupCode === 'A'),
			finalsData.current?.standingA ?? []
		)
	);
	let teamOptionsB = $derived(
		byStandingRank(
			finalsTeams.filter((team) => team.groupCode === 'B'),
			finalsData.current?.standingB ?? []
		)
	);

	let semifinalsCanGenerate = $derived(
		finalsData.current ? canGenerateSemifinals(semifinalSelection) : false
	);
	let semifinalsHint = $derived(finalsData.current ? getSemifinalsHint(semifinalSelection) : null);
	let fifthPlaceCanGenerate = $derived(
		finalsData.current ? canGenerateFifthPlace(semifinalSelection) : false
	);
	let fifthPlaceHint = $derived(finalsData.current ? getFifthPlaceHint(semifinalSelection) : null);

	let finalsCanGenerate = $derived(
		canGenerateFinals(
			orderedTies.find((t) => t.tieCode === 'X-1'),
			orderedTies.find((t) => t.tieCode === 'X-2')
		)
	);
	let selectionTabItems = $derived([
		{ value: 'semifinal', label: '準決勝' },
		{ value: 'fifth_place', label: '5位決定戦' },
		...(finalsCanGenerate ? [{ value: 'final', label: '決勝・3位決定戦' }] : [])
	]);

	function getSuggestedTeamId(tieCode: string, side: 'A' | 'B') {
		const suggestion = finalsData.current?.semifinalSuggestions.find(
			(tie) => tie.tieCode === tieCode
		);
		return side === 'A' ? (suggestion?.teamAId ?? '') : (suggestion?.teamBId ?? '');
	}

	// 順位から自動提案された候補と異なるチームが選ばれている場合に警告を出す
	function isMismatch(tieCode: string, side: 'A' | 'B', selectedTeamId: string) {
		if (!selectedTeamId) return false;
		const suggested = getSuggestedTeamId(tieCode, side);
		return !!suggested && suggested !== selectedTeamId;
	}

	function getSeedSelection(): SemifinalSelection {
		const existing = (tieCode: string, side: 'A' | 'B') => {
			const tie = finalsData.current?.ties.find((item) => item.tieCode === tieCode);
			const teamId = side === 'A' ? tie?.teamAId : tie?.teamBId;
			return teamId ?? getSuggestedTeamId(tieCode, side);
		};
		return {
			x1TeamAId: existing('X-1', 'A'),
			x1TeamBId: existing('X-1', 'B'),
			x2TeamAId: existing('X-2', 'A'),
			x2TeamBId: existing('X-2', 'B'),
			x3TeamAId: existing('X-3', 'A'),
			x3TeamBId: existing('X-3', 'B')
		};
	}

	function applySeedSelection() {
		const next = getSeedSelection();
		const nextKey = JSON.stringify(next);
		if (selectionSeedKey === nextKey) return;
		for (const key of Object.keys(next) as (keyof SemifinalSelection)[]) {
			if (!semifinalSelection[key]) semifinalSelection[key] = next[key];
		}
		selectionSeedKey = nextKey;
	}

	$effect(() => {
		if (!finalsData.current) return;
		applySeedSelection();
	});

	function standingLabel(teamId: string) {
		const row = [
			...(finalsData.current?.standingA ?? []),
			...(finalsData.current?.standingB ?? [])
		].find((standing) => standing.teamId === teamId);
		if (!row?.rank) return null;
		return row.requiresTiebreaker ? `暫定${row.rank}位` : `${row.rank}位`;
	}

	function optionLabel(team: {
		id: string;
		name: string;
		shortName: string | null;
		groupCode: 'A' | 'B' | null;
	}) {
		const rank = standingLabel(team.id);
		return `${team.shortName ?? team.name}${rank ? `（${team.groupCode} ${rank}）` : ''}`;
	}

	let teamItemsA = $derived(
		teamOptionsA.map((team) => ({ value: team.id, label: optionLabel(team) }))
	);
	let teamItemsB = $derived(
		teamOptionsB.map((team) => ({ value: team.id, label: optionLabel(team) }))
	);

	function semifinalInput() {
		return {
			x1TeamAId: semifinalSelection.x1TeamAId,
			x1TeamBId: semifinalSelection.x1TeamBId,
			x2TeamAId: semifinalSelection.x2TeamAId,
			x2TeamBId: semifinalSelection.x2TeamBId
		};
	}

	function fifthPlaceInput() {
		return {
			x3TeamAId: semifinalSelection.x3TeamAId,
			x3TeamBId: semifinalSelection.x3TeamBId
		};
	}
</script>

<svelte:head>
	<title>決勝トーナメント | 東大リーグ団体戦</title>
</svelte:head>

{#snippet headerActions()}
	<RealtimeSync
		topics={['finals', 'schedule']}
		refresh={() => finalsData.refresh()}
		shouldRefresh={(update) => {
			const tieIds = finalsData.current?.ties.map((tie) => tie.id) ?? [];
			return shouldRefreshFinalsPage(update, tieIds);
		}}
	/>
{/snippet}

{#snippet mismatchWarning(show: boolean)}
	{#if show}
		<p class="flex items-center gap-1 text-xs text-amber-700">
			<TriangleAlert class="size-3.5 shrink-0" />
			推奨候補と異なるチームです
		</p>
	{/if}
{/snippet}

<PageHeader title="決勝トーナメント" actions={headerActions} />

{#if finalsData.current}
	<Card>
		{#snippet header()}
			<h2 class="font-semibold">試合生成</h2>
		{/snippet}

		<AppTabs bind:value={selectionTab} items={selectionTabItems} />

		{#if selectionTab !== 'final'}
			<p class="my-4 text-xs text-muted-foreground">暫定順位から候補を入力済みです</p>
		{/if}

		{#if selectionTab === 'semifinal'}
			<div class="mt-4 grid gap-4 lg:grid-cols-2">
				<div class="space-y-2">
					<SectionLabel>準決勝1</SectionLabel>
					<div class="flex items-start gap-2">
						<div class="min-w-0 flex-1 space-y-1">
							<AppSelect
								name="x1TeamA"
								bind:value={semifinalSelection.x1TeamAId}
								items={teamItemsA}
								placeholder="Aリーグ枠"
							/>
							{@render mismatchWarning(isMismatch('X-1', 'A', semifinalSelection.x1TeamAId))}
						</div>
						<span class="mt-2.5 shrink-0 text-xs font-medium text-muted">vs</span>
						<div class="min-w-0 flex-1 space-y-1">
							<AppSelect
								name="x1TeamB"
								bind:value={semifinalSelection.x1TeamBId}
								items={teamItemsB}
								placeholder="Bリーグ枠"
							/>
							{@render mismatchWarning(isMismatch('X-1', 'B', semifinalSelection.x1TeamBId))}
						</div>
					</div>
				</div>
				<div class="space-y-2">
					<SectionLabel>準決勝2</SectionLabel>
					<div class="flex items-start gap-2">
						<div class="min-w-0 flex-1 space-y-1">
							<AppSelect
								name="x2TeamA"
								bind:value={semifinalSelection.x2TeamAId}
								items={teamItemsA}
								placeholder="Aリーグ枠"
							/>
							{@render mismatchWarning(isMismatch('X-2', 'A', semifinalSelection.x2TeamAId))}
						</div>
						<span class="mt-2.5 shrink-0 text-xs font-medium text-muted">vs</span>
						<div class="min-w-0 flex-1 space-y-1">
							<AppSelect
								name="x2TeamB"
								bind:value={semifinalSelection.x2TeamBId}
								items={teamItemsB}
								placeholder="Bリーグ枠"
							/>
							{@render mismatchWarning(isMismatch('X-2', 'B', semifinalSelection.x2TeamBId))}
						</div>
					</div>
				</div>
			</div>

			<div
				class="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between"
			>
				<AppButton
					disabled={!semifinalsCanGenerate}
					onclick={async () => {
						try {
							const r = await generateSemifinals(semifinalInput());
							await finalsData.refresh();
							if (r?.message) toast.success(r.message);
						} catch (e) {
							toast.error(e instanceof Error ? e.message : '失敗');
						}
					}}
				>
					準決勝生成
				</AppButton>
				{#if semifinalsHint}
					<p class="text-xs text-muted">{semifinalsHint}</p>
				{/if}
			</div>
		{:else if selectionTab === 'fifth_place'}
			<div class="mt-4 max-w-xl space-y-2">
				<SectionLabel>5位決定戦</SectionLabel>
				<div class="flex items-start gap-2">
					<div class="min-w-0 flex-1 space-y-1">
						<AppSelect
							name="x3TeamA"
							bind:value={semifinalSelection.x3TeamAId}
							items={teamItemsA}
							placeholder="Aリーグ枠"
						/>
						{@render mismatchWarning(isMismatch('X-3', 'A', semifinalSelection.x3TeamAId))}
					</div>
					<span class="mt-2.5 shrink-0 text-xs font-medium text-muted">vs</span>
					<div class="min-w-0 flex-1 space-y-1">
						<AppSelect
							name="x3TeamB"
							bind:value={semifinalSelection.x3TeamBId}
							items={teamItemsB}
							placeholder="Bリーグ枠"
						/>
						{@render mismatchWarning(isMismatch('X-3', 'B', semifinalSelection.x3TeamBId))}
					</div>
				</div>
			</div>

			<div
				class="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between"
			>
				<AppButton
					disabled={!fifthPlaceCanGenerate}
					onclick={async () => {
						try {
							const r = await generateFifthPlace(fifthPlaceInput());
							await finalsData.refresh();
							if (r?.message) toast.success(r.message);
						} catch (e) {
							toast.error(e instanceof Error ? e.message : '失敗');
						}
					}}
				>
					5位決定戦生成
				</AppButton>
				{#if fifthPlaceHint}
					<p class="text-xs text-muted">{fifthPlaceHint}</p>
				{/if}
			</div>
		{:else if selectionTab === 'final'}
			<div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<p class="text-xs text-muted-foreground">
					準決勝の結果が確定しました。決勝・3位決定戦を生成できます。
				</p>
				<AppButton
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
		{/if}
	</Card>
{/if}

{#if finalsData.current === null}
	<div class="space-y-1.5">
		{#each [0, 1, 2, 3, 4] as i (i)}
			<div class="animate-pulse space-y-2 rounded-xl border border-border-subtle bg-white p-4">
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
			<SectionLabel>準決勝 / 5位決定戦</SectionLabel>
			<DragDropProvider>
				<div class="space-y-1.5">
					{#each semis as tie, index (tie.id)}
						<SortableTieItem {tie} {index} sortable={false} teams={finalsTeams} />
					{/each}
				</div>
			</DragDropProvider>
		</section>
	{/if}

	{#if finals.length > 0}
		<section class="space-y-2">
			<SectionLabel>決勝 / 3位決定戦</SectionLabel>
			<DragDropProvider>
				<div class="space-y-1.5">
					{#each finals as tie, index (tie.id)}
						<SortableTieItem {tie} {index} sortable={false} teams={finalsTeams} />
					{/each}
				</div>
			</DragDropProvider>
		</section>
	{/if}
{/if}
