<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import GroupStandingsTable from '$lib/components/GroupStandingsTable.svelte';
	import { getGroupStandings } from './live.remote';

	let { realtimeEnabled }: { realtimeEnabled: boolean } = $props();

	const standings = getGroupStandings();

	$effect(() => {
		if (!realtimeEnabled) return;
		const id = setInterval(() => standings.refresh(), 8000);
		return () => clearInterval(id);
	});

	const groups = $derived(
		standings.current
			? [
					{ label: 'Aリーグ', rows: standings.current.standingA, ties: standings.current.groupA },
					{ label: 'Bリーグ', rows: standings.current.standingB, ties: standings.current.groupB }
				].filter((g) => g.rows.length > 0)
			: []
	);

	type StandingData = NonNullable<typeof standings.current>;
	function groupTeams(rows: StandingData['standingA'], allTeams: StandingData['teams']) {
		return rows.map((row) => allTeams.find((t) => t.id === row.teamId)).filter((t) => t != null);
	}
</script>

{#if standings.current == null}
	<section class="space-y-3">
		<div class="h-3 w-16 animate-pulse rounded-full bg-zinc-200"></div>
		<div class="grid gap-4 xl:grid-cols-2">
			{#each [0, 1] as i (i)}
				<div class="animate-pulse overflow-hidden rounded-2xl border border-zinc-100 bg-white">
					<div class="border-b border-zinc-100 px-4 py-3">
						<div class="h-4 w-16 rounded-full bg-zinc-200"></div>
					</div>
					<div class="px-4 py-3 space-y-3">
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
		<h2 class="text-xs font-semibold tracking-wider text-zinc-400">順位表</h2>
		<div class="grid gap-4 xl:grid-cols-2">
			{#each groups as group (group.label)}
				{@const teams = groupTeams(group.rows, standings.current!.teams)}
				<Card class="overflow-hidden">
					<div class="border-b border-zinc-100 px-4 py-3">
						<h3 class="text-sm font-semibold text-zinc-950">{group.label}</h3>
					</div>
					<GroupStandingsTable standings={group.rows} ties={group.ties} {teams} />
				</Card>
			{/each}
		</div>
	</section>
{/if}
