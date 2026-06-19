<script lang="ts">
	import { resolve } from '$app/paths';
	import Badge from '$lib/components/Badge.svelte';
	import type { GroupStanding } from '$lib/server/services/standingService';
	import { cn } from '$lib/utils/cn';
	import { getCellInfo, type StandingsTieRecord } from '$lib/utils/standings';
	import type { Snippet } from 'svelte';

	type TieRecord = StandingsTieRecord;

	let {
		standings,
		ties,
		teams,
		linkTies = false,
		extraHead,
		extraCell
	}: {
		standings: GroupStanding[];
		ties: TieRecord[];
		teams: { id: string; name: string }[];
		linkTies?: boolean;
		extraHead?: Snippet;
		extraCell?: Snippet<[GroupStanding]>;
	} = $props();

	function cellInfo(rowTeamId: string, colTeamId: string) {
		return getCellInfo(rowTeamId, colTeamId, ties);
	}
</script>

<div class="overflow-x-auto">
	<table class="w-full min-w-[28rem] text-sm whitespace-nowrap sm:min-w-180">
		<thead>
			<tr class="border-b border-zinc-100">
				<th class="w-8 px-2 py-2 text-left text-xs font-medium text-zinc-400 sm:w-10 sm:px-4"
					>順位</th
				>
				<th
					class="min-w-24 px-2 py-2 text-left text-xs font-medium text-zinc-400 sm:min-w-28 sm:px-4"
					>チーム</th
				>
				{#each teams as team (team.id)}
					<th
						class="min-w-14 px-1 py-2 text-center text-[10px] font-medium text-zinc-400 sm:min-w-18 sm:px-2 sm:text-xs"
					>
						{team.name}
					</th>
				{/each}
				<th
					class="w-12 px-1 py-2 text-center text-[10px] font-medium text-zinc-400 sm:w-16 sm:px-2 sm:text-xs"
					>団体</th
				>
				<th
					class="w-12 px-1 py-2 text-center text-[10px] font-medium text-zinc-400 sm:w-16 sm:px-2 sm:text-xs"
					>種目</th
				>
				<th
					class="w-12 px-1 py-2 text-center text-[10px] font-medium text-zinc-400 sm:w-16 sm:px-2 sm:text-xs"
					>ゲーム</th
				>
				{@render extraHead?.()}
			</tr>
		</thead>
		<tbody>
			{#if standings.length === 0}
				<tr>
					<td colspan={4 + teams.length} class="px-4 py-8 text-center text-sm text-zinc-500">
						チームが登録されると順位表が表示されます。
					</td>
				</tr>
			{:else}
				{#each standings as row (row.teamId)}
					<tr
						class="border-b border-zinc-50 last:border-0 {row.requiresTiebreaker
							? 'bg-amber-50'
							: ''}"
					>
						<td
							class="px-2 py-2.5 text-center text-sm font-bold text-zinc-400 tabular-nums sm:px-4"
						>
							{row.rank ?? '—'}
						</td>
						<td class="px-2 py-2.5 font-medium text-zinc-950 sm:px-4">{row.teamName}</td>
						{#each teams as col (col.id)}
							<td class="px-1 py-2.5 text-center sm:px-2">
								{#if row.teamId === col.id}
									<span class="text-zinc-200">—</span>
								{:else}
									{@const cell = cellInfo(row.teamId, col.id)}
									{#if cell?.done}
										{@const colorClass = cell.won
											? 'bg-emerald-50 text-emerald-700'
											: cell.lost
												? 'bg-rose-50 text-rose-700'
												: 'bg-zinc-100 text-zinc-600'}
										{#if linkTies}
											<a
												href={resolve('/ties/[tieId]', { tieId: cell.tie.id })}
												class={cn(
													'inline-flex min-w-12 flex-col items-center rounded-lg px-2 py-0.5 text-xs font-semibold',
													colorClass
												)}
											>
												<span class="font-normal opacity-50">{cell.tie.tieCode}</span>
												<span class="tabular-nums">{cell.myScore}–{cell.theirScore}</span>
											</a>
										{:else}
											<span
												class={cn(
													'inline-flex min-w-12 flex-col items-center rounded-lg px-2 py-0.5 text-xs font-semibold',
													colorClass
												)}
											>
												<span class="font-normal opacity-50">{cell.tie.tieCode}</span>
												<span class="tabular-nums">{cell.myScore}–{cell.theirScore}</span>
											</span>
										{/if}
									{:else if cell}
										{#if linkTies}
											<a
												href={resolve('/ties/[tieId]', { tieId: cell.tie.id })}
												class="inline-flex flex-col items-center hover:opacity-80"
											>
												<span class="text-[10px] text-zinc-400">{cell.tie.tieCode}</span>
												<Badge
													color={cell.tie.status === 'playing' ? 'emerald' : 'zinc'}
													variant="subtle"
													size="sm"
												>
													{cell.tie.status === 'playing' ? '進行中' : '予定'}
												</Badge>
											</a>
										{:else}
											<div class="inline-flex flex-col items-center">
												<span class="text-[10px] text-zinc-400">{cell.tie.tieCode}</span>
												<Badge
													color={cell.tie.status === 'playing' ? 'emerald' : 'zinc'}
													variant="subtle"
													size="sm"
												>
													{cell.tie.status === 'playing' ? '進行中' : '予定'}
												</Badge>
											</div>
										{/if}
									{:else}
										<span class="text-xs text-zinc-300">-</span>
									{/if}
								{/if}
							</td>
						{/each}
						<td class="px-1 py-2.5 text-center text-zinc-700 tabular-nums sm:px-2">
							{row.teamMatchesWon}-{row.teamMatchesLost}
						</td>
						<td class="px-1 py-2.5 text-center text-zinc-700 tabular-nums sm:px-2">
							{row.rubbersWon}-{row.rubbersLost}
						</td>
						<td class="px-1 py-2.5 text-center text-zinc-400 tabular-nums sm:px-2">
							{row.gamesWon}-{row.gamesLost}
						</td>
						{@render extraCell?.(row)}
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>
