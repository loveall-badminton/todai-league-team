<script lang="ts">
	import { resolve } from '$app/paths';
	import AppButton from '$lib/components/AppButton.svelte';
	import Card from '$lib/components/Card.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import TieRubberList from '$lib/components/TieRubberList.svelte';
	import type { RubberRow } from '$lib/types/entities';

	let {
		rubbers,
		teamAName,
		teamBName,
		onConfirmMatch,
		onUnconfirmMatch
	}: {
		rubbers: RubberRow[];
		teamAName: string;
		teamBName: string;
		onConfirmMatch: (matchId: string) => void;
		onUnconfirmMatch: (matchId: string) => void;
	} = $props();

	import { rubberStatusLabel } from '$lib/domain/tokyoLeagueLabels';
	import { rubberStatusTextClass } from './tiePageHelpers';
	const rubberStatusBgClass = rubberStatusTextClass;
</script>

{#snippet rubberExtraHead()}
	<th class="w-24 px-4 py-3 text-left text-xs font-medium text-zinc-400">状態</th>
	<th class="w-32 px-4 py-3 text-left text-xs font-medium text-zinc-400">操作</th>
{/snippet}

{#snippet rubberExtraCell(row: RubberRow)}
	<td class="px-4 py-3">
		<span class="text-xs {rubberStatusBgClass(row.status)}">
			{rubberStatusLabel(row.status)}
		</span>
	</td>
	<td class="px-4 py-3">
		<div class="flex flex-wrap items-center gap-2">
			{#if row.matchId}
				<AppButton
					variant="secondary"
					size="sm"
					href={resolve('/referee/[matchId]', { matchId: row.matchId })}
				>
					スコア入力
				</AppButton>
			{:else}
				<span class="text-xs text-zinc-400">—</span>
			{/if}
			{#if row.matchId && row.matchStatus === 'confirmed'}
				<ConfirmDialog
					onConfirm={() => onUnconfirmMatch(row.matchId!)}
					triggerLabel="承認解除"
					triggerClass="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
					title="試合結果の承認を解除しますか？"
					description="承認を解除すると審判画面での再操作が可能になります。"
					confirmLabel="承認を解除する"
					confirmVariant="warning"
					confirmClass="border border-amber-300"
				/>
			{:else if row.matchId && ['finished', 'forfeited', 'retired'].includes(row.matchStatus ?? '')}
				<ConfirmDialog
					onConfirm={() => onConfirmMatch(row.matchId!)}
					triggerLabel="運営承認"
					triggerClass="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
					title="試合結果を運営承認しますか？"
					description="承認後は審判画面を含むすべての画面で結果の変更ができなくなります。"
					confirmLabel="運営承認する"
					confirmVariant="success"
				/>
			{/if}
		</div>
	</td>
{/snippet}

<Card flush>
	{#snippet header()}
		<h2 class="font-semibold">種目別結果</h2>
	{/snippet}
	<TieRubberList
		{rubbers}
		{teamAName}
		{teamBName}
		variant="table"
		extraHead={rubberExtraHead}
		extraCell={rubberExtraCell}
	/>
</Card>
