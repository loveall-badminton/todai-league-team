<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { DragDropProvider, DragOverlay } from '@dnd-kit/svelte';
	import { createSortableHandlers } from '$lib/utils/dndEvents';
	import Card from '$lib/components/Card.svelte';
	import { tiebreakerStatusLabel } from '$lib/domain/tokyoLeagueLabels';
	import Badge from '$lib/components/Badge.svelte';
	import GroupStandingsTable from '$lib/components/GroupStandingsTable.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import AppButton from '$lib/components/AppButton.svelte';
	import FormToast from '$lib/components/FormToast.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import { GripVertical } from '@lucide/svelte';
	import SortableTieItem from '$lib/components/SortableTieItem.svelte';
	import type { PageProps } from './$types';
	import { toast } from 'svelte-sonner';
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

	const { onDragStart, onDragOver, onDragEnd } = createSortableHandlers(
		() => allTies,
		(v) => {
			allTies = v;
		},
		(ids) => reorder({ ids })
	);

	const teamName = (teamId: string | null) =>
		data.allTeams.find((t) => t.id === teamId)?.name ?? '不明';

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

	async function run(fn: () => Promise<unknown>) {
		try {
			const result = await fn();
			await invalidateAll();
			if (result && typeof result === 'object' && 'message' in result) {
				toast.success(String((result as { message: string }).message));
			}
		} catch (e) {
			toast.error(e instanceof Error ? e.message : '失敗');
		}
	}
</script>

<svelte:head>
	<title>{data.groupCode}リーグ | 東大リーグ団体戦</title>
</svelte:head>

{#snippet headerActions()}
	<AppButton onclick={() => run(() => generateRoundRobin())}>総当たり生成</AppButton>
{/snippet}

<PageHeader eyebrow="予選リーグ" title={`${data.groupCode}リーグ`} actions={headerActions} />

<!-- Teams -->
<Card class="p-5">
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
</Card>

<!-- Standings + round-robin matrix (merged) -->
{#snippet standingsExtraHead()}
	<th class="w-20 px-4 py-2 text-left text-xs font-medium text-zinc-400">状態</th>
	<th class="min-w-48 px-4 py-2 text-left text-xs font-medium text-zinc-400">手動順位</th>
{/snippet}

{#snippet standingsExtraCell(row: (typeof data.standings)[number])}
	{@const rankForm = setManualRank.for(row.teamId)}
	<td class="px-4 py-2.5">
		{#if row.requiresTiebreaker}
			<Badge color="amber">再試合必要</Badge>
		{:else if row.manualRank}
			<Badge>手動</Badge>
		{:else}
			<span class="text-xs text-zinc-500">{row.headToHeadSummary ?? '自動判定'}</span>
		{/if}
	</td>
	<td class="px-4 py-2.5">
		<form {...rankForm} class="flex items-center gap-2">
			<input {...rankForm.fields.teamId.as('hidden', row.teamId)} />
			<AppInput
				type="number"
				{...rankForm.fields.manualRank.as('text', String(row.manualRank ?? row.rank ?? ''))}
				min="1"
				class="w-14 px-2 py-1.5 tabular-nums"
			/>
			<AppInput
				{...rankForm.fields.reason.as('text')}
				placeholder="理由"
				class="w-24 px-2 py-1.5"
			/>
			<button
				class="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
			>
				保存
			</button>
		</form>
	</td>
{/snippet}

<Card class="min-w-0">
	<div class="border-b border-zinc-100 px-5 py-4">
		<h2 class="font-semibold">順位表</h2>
	</div>

	<GroupStandingsTable
		standings={data.standings}
		ties={data.ties}
		teams={orderedTeams}
		linkTies={true}
		extraHead={standingsExtraHead}
		extraCell={standingsExtraCell}
	/>
</Card>

<!-- Ties -->
<section class="space-y-3">
	<h2 class="font-semibold">総当たり対戦</h2>

	{#if allTies.length === 0}
		<EmptyState message="チームが2つ以上ある場合、総当たり対戦を生成できます。" />
	{:else}
		<DragDropProvider {onDragStart} {onDragOver} {onDragEnd}>
			<div class="space-y-2">
				{#each allTies as tie, index (tie.id)}
					<SortableTieItem {tie} {index} teams={data.allTeams} tieForm={updateTie.for(tie.id)} />
				{/each}
			</div>
			<DragOverlay dropAnimation={null}>
				{#snippet children(draggable)}
					{@const tie = allTies.find((t) => t.id === String(draggable.id))}
					{#if tie}
						<div
							class="overflow-hidden rounded-xl border border-zinc-200 bg-white opacity-95 shadow-xl"
						>
							<div class="flex items-stretch">
								<div
									class="flex shrink-0 cursor-grabbing items-center border-r border-zinc-100 px-3 text-zinc-400"
								>
									<GripVertical class="h-4 w-4" />
								</div>
								<div class="flex flex-1 items-center px-4 py-3">
									<div class="flex min-w-0 flex-col gap-0.5">
										<span class="font-semibold text-zinc-900">{tie.tieCode}</span>
										<p class="truncate text-sm text-zinc-600">
											{tie.teamAName ?? '未定'} <span class="text-zinc-400">vs</span>
											{tie.teamBName ?? '未定'}
										</p>
									</div>
								</div>
							</div>
						</div>
					{/if}
				{/snippet}
			</DragOverlay>
		</DragDropProvider>
	{/if}
</section>

<!-- Ranking Tiebreakers -->
<Card>
	<div class="border-b border-zinc-100 px-5 py-4">
		<h2 class="font-semibold">順位決定再試合</h2>
	</div>
	<div class="space-y-5 p-5">
		<!-- Create form -->
		<form {...createTiebreaker} class="grid gap-3 lg:grid-cols-6">
			<div class="grid gap-1">
				<span class="text-xs font-medium text-zinc-500">A側チーム</span>
				<AppSelect
					{...createTiebreaker.fields.teamAId.as('select')}
					items={groupTeamItems}
					required
				/>
			</div>
			<div class="grid gap-1">
				<span class="text-xs font-medium text-zinc-500">A側選手</span>
				<AppSelect
					{...createTiebreaker.fields.playerAId.as('select')}
					items={allPlayerItems}
					required
				/>
			</div>
			<div class="grid gap-1">
				<span class="text-xs font-medium text-zinc-500">B側チーム</span>
				<AppSelect
					{...createTiebreaker.fields.teamBId.as('select')}
					items={groupTeamItems}
					required
				/>
			</div>
			<div class="grid gap-1">
				<span class="text-xs font-medium text-zinc-500">B側選手</span>
				<AppSelect
					{...createTiebreaker.fields.playerBId.as('select')}
					items={allPlayerItems}
					required
				/>
			</div>
			<div class="grid gap-1 lg:col-span-2">
				<span class="text-xs font-medium text-zinc-500">理由</span>
				<AppInput
					{...createTiebreaker.fields.reason.as('text')}
					placeholder="順位未確定のため"
					required
				/>
			</div>
			<div class="lg:col-span-6">
				<AppButton type="submit">再試合作成</AppButton>
			</div>
		</form>
		<FormToast result={createTiebreaker.result} />

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
								<AppButton
									variant="secondary"
									size="sm"
									href={resolve('/referee/[matchId]', { matchId: item.matchId })}
								>
									審判
								</AppButton>
								<AppButton
									variant="secondary"
									size="sm"
									onclick={() => run(() => syncTiebreaker({ matchId: item.matchId! }))}
								>
									同期
								</AppButton>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-sm text-zinc-500">作成済みの順位決定再試合はありません。</p>
		{/if}
	</div>
</Card>
