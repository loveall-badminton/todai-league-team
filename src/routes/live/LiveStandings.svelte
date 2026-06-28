<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import GroupStandingsTable from '$lib/components/GroupStandingsTable.svelte';
	import type { LivePageData } from '$lib/server/services/livePageService';
	import type { QueryValue } from '$lib/utils/types';
	import SectionLabel from '$lib/components/SectionLabel.svelte';
	import { resolve } from '$app/paths';

	let { query }: { query: QueryValue<LivePageData['standings']> } = $props();

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
	<section class="space-y-3">
		<SectionLabel>順位表</SectionLabel>
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
