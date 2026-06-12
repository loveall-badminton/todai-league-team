<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { DragDropProvider } from '@dnd-kit/svelte';
	import { isSortable } from '@dnd-kit/svelte/sortable';
	import type { ComponentProps } from 'svelte';
	type DragOverEvent = Parameters<
		NonNullable<ComponentProps<typeof DragDropProvider>['onDragOver']>
	>[0];
	type DragEndEvent = Parameters<
		NonNullable<ComponentProps<typeof DragDropProvider>['onDragEnd']>
	>[0];
	import { tiebreakerStatusLabel } from '$lib/domain/tokyoLeagueLabels';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import SortableGroupTie from './SortableGroupTie.svelte';
	import type { PageProps } from './$types';
	import {
		generateRoundRobin,
		setManualRank,
		createTiebreaker,
		syncTiebreaker,
		reorder,
		updateTie
	} from './group.remote';

	let { data }: PageProps = $props();

	let allTies = $derived([...data.ties]);
	let snapshot: typeof allTies = [];
	let cmdMessage = $state<string | null>(null);
	let cmdError = $state<string | null>(null);

	function onDragStart() {
		snapshot = allTies.slice();
	}

	function onDragOver(event: DragOverEvent) {
		const { source, target } = event.operation;
		if (isSortable(source) && isSortable(target) && source.index !== target.index) {
			const next = [...allTies];
			const [moved] = next.splice(source.index, 1);
			next.splice(target.index, 0, moved);
			allTies = next;
		}
	}

	async function onDragEnd(event: DragEndEvent) {
		if (event.canceled) {
			allTies = snapshot;
			return;
		}
		await reorder({ ids: allTies.map((t) => t.id) });
	}

	const teamName = (teamId: string | null) =>
		data.allTeams.find((t) => t.id === teamId)?.name ?? '不明';

	let tiebreakerTeamAId = $state('');
	let tiebreakerPlayerAId = $state('');
	let tiebreakerTeamBId = $state('');
	let tiebreakerPlayerBId = $state('');

	let groupTeamItems = $derived([
		{ value: '', label: '選択' },
		...data.groupTeams.map((t) => ({ value: t.id, label: t.name }))
	]);

	let allPlayerItems = $derived([
		{ value: '', label: '選択' },
		...data.groupTeams.flatMap((team) =>
			(data.groupTeamPlayers.find((r) => r.teamId === team.id)?.players ?? []).map((player) => ({
				value: player.id,
				label: `${team.name} / ${player.name}`
			}))
		)
	]);

	// Round-robin matrix helpers
	let orderedTeams = $derived(
		data.standings.length > 0
			? data.standings
					.map((r) => data.groupTeams.find((t) => t.id === r.teamId))
					.filter((t) => t != null)
			: data.groupTeams
	);

	function tieForPair(rowTeamId: string, colTeamId: string) {
		return data.ties.find(
			(t) =>
				(t.teamAId === rowTeamId && t.teamBId === colTeamId) ||
				(t.teamAId === colTeamId && t.teamBId === rowTeamId)
		);
	}

	function cellInfo(rowTeamId: string, colTeamId: string) {
		const tie = tieForPair(rowTeamId, colTeamId);
		if (!tie) return null;
		const myScore = tie.teamAId === rowTeamId ? tie.teamScoreA : tie.teamScoreB;
		const theirScore = tie.teamAId === rowTeamId ? tie.teamScoreB : tie.teamScoreA;
		const done = tie.status === 'confirmed' || tie.status === 'finished';
		return { tie, myScore, theirScore, won: myScore > theirScore, done };
	}

	async function run(fn: () => Promise<unknown>) {
		cmdMessage = null;
		cmdError = null;
		try {
			const result = await fn();
			await invalidateAll();
			if (result && typeof result === 'object' && 'message' in result) {
				cmdMessage = String((result as { message: string }).message);
			}
		} catch (e) {
			cmdError = e instanceof Error ? e.message : '失敗';
		}
	}
</script>

<svelte:head>
	<title>{data.groupCode}リーグ | 東大リーグ団体戦</title>
</svelte:head>

<div class="min-h-screen min-w-0 bg-zinc-50 px-4 py-8 text-zinc-950 sm:px-6">
	<div class="min-w-0 space-y-8">
		<!-- Header -->
		<header class="flex flex-wrap items-start justify-between gap-4">
			<div>
				<a class="text-sm text-zinc-500 hover:text-zinc-700" href={resolve('/groups')}>
					予選リーグ
				</a>
				<h1 class="mt-1 text-2xl font-semibold tracking-tight">{data.groupCode}リーグ</h1>
			</div>
			<button
				class="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
				onclick={() => run(() => generateRoundRobin())}
			>
				総当たり生成
			</button>
		</header>

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

		<!-- Teams -->
		<section class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
			<h2 class="text-sm font-medium tracking-wide text-zinc-500">所属チーム</h2>
			<div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.groupTeams as team (team.id)}
					<a
						class="flex items-center justify-between rounded-xl border border-zinc-100 px-4 py-3 hover:border-zinc-300"
						href={resolve('/teams/[teamId]', { teamId: team.id })}
					>
						<span class="text-sm font-medium">{team.name}</span>
						<span class="text-xs text-zinc-500">{team.playerCount}名</span>
					</a>
				{:else}
					<p class="col-span-full text-sm text-zinc-500">チームが登録されていません。</p>
				{/each}
			</div>
		</section>

		<!-- Standings + round-robin matrix (merged) -->
		<section class="min-w-0 rounded-2xl border border-zinc-200 bg-white shadow-sm">
			<div class="border-b border-zinc-100 px-5 py-4">
				<h2 class="font-semibold">順位表</h2>
			</div>
			<div class="overflow-x-auto">
				<table class="w-full min-w-240 text-sm whitespace-nowrap">
					<thead>
						<tr class="border-b border-zinc-100">
							<th class="w-10 px-4 py-3 text-left text-xs font-medium text-zinc-400">順位</th>
							<th class="min-w-28 px-4 py-3 text-left text-xs font-medium text-zinc-400">チーム</th>
							{#each orderedTeams as col (col.id)}
								<th class="min-w-18 px-3 py-3 text-center text-xs font-medium text-zinc-400">
									{col.name}
								</th>
							{/each}
							<th class="w-20 px-4 py-3 text-center text-xs font-medium text-zinc-400">団体</th>
							<th class="w-20 px-4 py-3 text-center text-xs font-medium text-zinc-400">種目</th>
							<th class="w-20 px-4 py-3 text-center text-xs font-medium text-zinc-400">ゲーム</th>
							<th class="w-20 px-4 py-3 text-left text-xs font-medium text-zinc-400">状態</th>
							<th class="min-w-48 px-4 py-3 text-left text-xs font-medium text-zinc-400"
								>手動順位</th
							>
						</tr>
					</thead>
					<tbody>
						{#if data.standings.length === 0}
							<tr>
								<td
									colspan={4 + orderedTeams.length}
									class="px-4 py-8 text-center text-sm text-zinc-500"
								>
									チームが登録されると順位表が表示されます。
								</td>
							</tr>
						{:else}
							{#each data.standings as row (row.teamId)}
								{@const rankForm = setManualRank.for(row.teamId)}
								<tr
									class="border-b border-zinc-100 last:border-0 {row.requiresTiebreaker
										? 'bg-amber-50'
										: ''}"
								>
									<td class="px-4 py-3 font-semibold tabular-nums">{row.rank ?? '-'}</td>
									<td class="px-4 py-3 font-medium">{row.teamName}</td>
									<!-- vs each opponent -->
									{#each orderedTeams as col (col.id)}
										<td class="px-3 py-3 text-center">
											{#if row.teamId === col.id}
												<span class="text-zinc-200">—</span>
											{:else}
												{@const cell = cellInfo(row.teamId, col.id)}
												{#if cell?.done}
													<a
														href={resolve('/ties/[tieId]', { tieId: cell.tie.id })}
														class="inline-flex items-center gap-0.5 rounded-lg px-2 py-0.5 text-xs font-semibold
															{cell.won ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}"
													>
														{cell.myScore}–{cell.theirScore}
													</a>
												{:else if cell}
													<a
														href={resolve('/ties/[tieId]', { tieId: cell.tie.id })}
														class="text-xs text-zinc-400 hover:text-zinc-600"
													>
														{#if cell.tie.status === 'playing'}進行中{:else}予定{/if}
													</a>
												{:else}
													<span class="text-xs text-zinc-300">-</span>
												{/if}
											{/if}
										</td>
									{/each}
									<td class="px-4 py-3 text-center text-zinc-700 tabular-nums">
										{row.teamMatchesWon}-{row.teamMatchesLost}
									</td>
									<td class="px-4 py-3 text-center text-zinc-700 tabular-nums">
										{row.rubbersWon}-{row.rubbersLost}
									</td>
									<td class="px-4 py-3 text-center text-zinc-700 tabular-nums">
										{row.gamesWon}-{row.gamesLost}
									</td>
									<td class="px-4 py-3">
										{#if row.requiresTiebreaker}
											<span
												class="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800"
											>
												再試合必要
											</span>
										{:else if row.manualRank}
											<span
												class="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600"
											>
												手動
											</span>
										{:else}
											<span class="text-xs text-zinc-500"
												>{row.headToHeadSummary ?? '自動判定'}</span
											>
										{/if}
									</td>
									<td class="px-4 py-3">
										<form {...rankForm} class="flex items-center gap-2">
											<input type="hidden" name="teamId" value={row.teamId} />
											<AppInput
												name="manualRank"
												type="number"
												min="1"
												value={row.manualRank ?? row.rank ?? ''}
												class="w-14 px-2 py-1.5 tabular-nums"
											/>
											<AppInput name="reason" placeholder="理由" class="w-24 px-2 py-1.5" />
											<button
												class="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
											>
												保存
											</button>
										</form>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</section>

		<!-- Ties -->
		<section class="space-y-3">
			<h2 class="font-semibold">総当たり対戦</h2>

			{#if allTies.length === 0}
				<div
					class="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-8 text-center text-sm text-zinc-500"
				>
					チームが2つ以上ある場合、総当たり対戦を生成できます。
				</div>
			{:else}
				<DragDropProvider {onDragStart} {onDragOver} {onDragEnd}>
					<div class="space-y-2">
						{#each allTies as tie, index (tie.id)}
							<SortableGroupTie
								{tie}
								{index}
								allTeams={data.allTeams}
								tieForm={updateTie.for(tie.id)}
							/>
						{/each}
					</div>
				</DragDropProvider>
			{/if}
		</section>

		<!-- Ranking Tiebreakers -->
		<section class="rounded-2xl border border-zinc-200 bg-white shadow-sm">
			<div class="border-b border-zinc-100 px-5 py-4">
				<h2 class="font-semibold">順位決定再試合</h2>
			</div>
			<div class="space-y-5 p-5">
				<!-- Create form -->
				<form {...createTiebreaker} class="grid gap-3 lg:grid-cols-6">
					<div class="grid gap-1">
						<span class="text-xs font-medium text-zinc-500">A側チーム</span>
						<AppSelect
							name="teamAId"
							bind:value={tiebreakerTeamAId}
							items={groupTeamItems}
							required
						/>
					</div>
					<div class="grid gap-1">
						<span class="text-xs font-medium text-zinc-500">A側選手</span>
						<AppSelect
							name="playerAId"
							bind:value={tiebreakerPlayerAId}
							items={allPlayerItems}
							required
						/>
					</div>
					<div class="grid gap-1">
						<span class="text-xs font-medium text-zinc-500">B側チーム</span>
						<AppSelect
							name="teamBId"
							bind:value={tiebreakerTeamBId}
							items={groupTeamItems}
							required
						/>
					</div>
					<div class="grid gap-1">
						<span class="text-xs font-medium text-zinc-500">B側選手</span>
						<AppSelect
							name="playerBId"
							bind:value={tiebreakerPlayerBId}
							items={allPlayerItems}
							required
						/>
					</div>
					<div class="grid gap-1 lg:col-span-2">
						<span class="text-xs font-medium text-zinc-500">理由</span>
						<AppInput name="reason" placeholder="順位未確定のため" required />
					</div>
					<div class="lg:col-span-6">
						<button
							class="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
						>
							再試合作成
						</button>
					</div>
				</form>
				{#if createTiebreaker.result?.message}
					<div class="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700">
						{createTiebreaker.result.message}
					</div>
				{/if}

				<!-- Tiebreaker list -->
				{#if data.rankingTiebreakers.length > 0}
					<div class="space-y-2 border-t border-zinc-100 pt-2">
						{#each data.rankingTiebreakers as item (item.id)}
							<div
								class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-100 px-4 py-3 text-sm"
							>
								<div class="space-y-0.5">
									<p class="font-medium">{item.reason}</p>
									<p class="text-xs text-zinc-500">
										{tiebreakerStatusLabel(item.status)}
										{#if item.winnerTeamId}
											/ 勝者: {teamName(item.winnerTeamId)}
										{/if}
									</p>
								</div>
								{#if item.matchId}
									<div class="flex items-center gap-2">
										<a
											class="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
											href={resolve('/referee/[matchId]', { matchId: item.matchId })}
										>
											審判
										</a>
										<button
											class="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
											onclick={() => run(() => syncTiebreaker({ matchId: item.matchId! }))}
										>
											同期
										</button>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-zinc-500">作成済みの順位決定再試合はありません。</p>
				{/if}
			</div>
		</section>
	</div>
</div>
