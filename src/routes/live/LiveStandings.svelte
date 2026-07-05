<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import GroupStandingsTable from '$lib/components/GroupStandingsTable.svelte';
	import type { StandingsData } from '$lib/server/services/livePageService';
	import type { QueryValue } from '$lib/utils/types';
	import SectionLabel from '$lib/components/SectionLabel.svelte';
	import { resolve } from '$app/paths';
	import { tieStatusLabel } from '$lib/domain/tokyoLeagueLabels';

	let { query }: { query: QueryValue<StandingsData> } = $props();

	const groups = $derived(
		query.current
			? [
					{ label: 'Aリーグ', rows: query.current.standingA, ties: query.current.groupA },
					{ label: 'Bリーグ', rows: query.current.standingB, ties: query.current.groupB }
				].filter((g) => g.rows.length > 0)
			: []
	);

	type StandingData = NonNullable<typeof query.current>;
	function groupTeams(rows: StandingData['standingA'], allTeams: StandingData['teams']) {
		return rows
			.map((row: StandingData['standingA'][number]) =>
				allTeams.find((t: StandingData['teams'][number]) => t.id === row.teamId)
			)
			.filter(
				(t: StandingData['teams'][number] | undefined): t is StandingData['teams'][number] =>
					t != null
			);
	}

	type FinalsTie = StandingData['finalsTies'][number];

	function rankEntriesFromTie(
		tie: FinalsTie,
		winnerRank: number,
		loserRank: number
	): { rank: number; name: string | null; tieId: string; confirmed: boolean }[] {
		const confirmed = tie.status === 'confirmed';
		if (confirmed && tie.winnerTeamId) {
			const winnerName = tie.winnerTeamId === tie.teamAId ? tie.teamAName : tie.teamBName;
			const loserName = tie.winnerTeamId === tie.teamAId ? tie.teamBName : tie.teamAName;
			return [
				{ rank: winnerRank, name: winnerName, tieId: tie.id, confirmed: true },
				{ rank: loserRank, name: loserName, tieId: tie.id, confirmed: true }
			];
		}
		return [
			{ rank: winnerRank, name: null, tieId: tie.id, confirmed: false },
			{ rank: loserRank, name: null, tieId: tie.id, confirmed: false }
		];
	}

	let finalRanks = $derived.by(() => {
		const ties = query.current?.finalsTies ?? [];
		const final = ties.find((t) => t.phase === 'final');
		const thirdPlace = ties.find((t) => t.phase === 'third_place');
		const fifthPlace = ties.find((t) => t.phase === 'fifth_place');
		const entries = [
			...(final ? rankEntriesFromTie(final, 1, 2) : []),
			...(thirdPlace ? rankEntriesFromTie(thirdPlace, 3, 4) : []),
			...(fifthPlace ? rankEntriesFromTie(fifthPlace, 5, 6) : [])
		];
		return entries.sort((a, b) => a.rank - b.rank);
	});

	let finalsTies = $derived(query.current?.finalsTies ?? []);
</script>

{#if query.current == null}
	<section class="space-y-3">
		<div class="h-3 w-16 animate-pulse rounded-full bg-zinc-200"></div>
		<div class="grid gap-4 xl:grid-cols-2">
			{#each [0, 1] as i (i)}
				<div class="animate-pulse overflow-hidden rounded-2xl border border-border-subtle bg-white">
					<div class="border-b border-border-subtle px-4 py-3">
						<div class="h-4 w-16 rounded-full bg-zinc-200"></div>
					</div>
					<div class="space-y-3 px-4 py-3">
						{#each [0, 1, 2, 3, 4] as j (j)}
							<div class="flex gap-3">
								<div class="h-3 w-4 rounded-full bg-zinc-100"></div>
								<div class="h-3 rounded-full bg-zinc-100" style="width: {40 + j * 10}%"></div>
								<div class="ml-auto h-3 w-16 rounded-full bg-zinc-100"></div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</section>
{:else if groups.length > 0}
	{#if finalsTies.length > 0}
		<section class="space-y-3">
			<SectionLabel>総合順位</SectionLabel>
			<Card flush class="overflow-hidden">
				<div class="divide-y divide-zinc-50">
					{#each finalRanks as entry (entry.rank)}
						{@const matchLabel =
							entry.rank <= 2 ? '決勝' : entry.rank <= 4 ? '3位決定戦' : '5位決定戦'}
						<a
							href={resolve('/live/ties/[tieId]', { tieId: entry.tieId })}
							data-sveltekit-preload-data="tap"
							class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 active:bg-zinc-100"
						>
							<span
								class="w-8 shrink-0 text-center text-sm font-bold tabular-nums {entry.confirmed
									? 'text-zinc-800'
									: 'text-zinc-300'}">{entry.rank}位</span
							>
							<span
								class="min-w-0 flex-1 text-sm {entry.confirmed
									? 'font-semibold text-zinc-900'
									: 'text-zinc-400'}"
							>
								{entry.name ?? `${matchLabel}待ち`}
							</span>
							{#if entry.confirmed}
								<span class="shrink-0 text-[11px] text-zinc-400">{matchLabel}</span>
							{:else}
								{@const tie = finalsTies.find((t) => t.id === entry.tieId)}
								<span class="shrink-0 text-[11px] text-zinc-400">
									{tie ? tieStatusLabel(tie.status) : ''}
								</span>
							{/if}
						</a>
					{/each}
				</div>
			</Card>
		</section>
	{/if}

	<section class="space-y-3">
		<SectionLabel>予選順位表</SectionLabel>
		<div class="grid gap-4 xl:grid-cols-2">
			{#each groups as group (group.label)}
				{@const teams = groupTeams(group.rows, query.current!.teams)}
				<Card class="overflow-hidden" flush>
					{#snippet header()}
						<h3 class="text-sm font-semibold text-default">{group.label}</h3>
					{/snippet}
					<GroupStandingsTable
						standings={group.rows}
						ties={group.ties}
						{teams}
						tieHref={(id) => resolve('/live/ties/[tieId]', { tieId: id })}
					/>
				</Card>
			{/each}
		</div>
	</section>
{/if}
