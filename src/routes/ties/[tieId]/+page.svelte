<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import RealtimeSync from '$lib/components/RealtimeSync.svelte';
	import { resolve } from '$app/paths';
	import AppButton from '$lib/components/AppButton.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Card from '$lib/components/Card.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import type { RubberRow } from '$lib/components/TieRubberList.svelte';
	import { RUBBER_DEFINITIONS } from '$lib/domain/tokyoLeague';
	import {
		courtDisplayLabel,
		phaseLabel,
		rubberLabel,
		submissionStatusLabel,
		tieStatusLabel
	} from '$lib/domain/tokyoLeagueLabels';
	import type { EntityOption } from '$lib/types/entities';
	import { ArrowLeft } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import TieEditForm from '$lib/components/TieEditForm.svelte';
	import type { PageProps } from './$types';
	import {
		confirmMatch,
		confirmTie,
		deleteTie,
		getLiveRubbers,
		lockLineup,
		revealLineups,
		startTie,
		unconfirmMatch,
		unlockLineup,
		unrevealLineups,
		updateTie
	} from './tie.remote';
	import { submissionBadgeColor, getCurrentWorkflowStep } from './tiePageHelpers';
	import TieWorkflowStepper from './TieWorkflowStepper.svelte';
	import TieResultsSection from './TieResultsSection.svelte';

	let { data }: PageProps = $props();

	const liveRubbers = getLiveRubbers();

	const teamName = (id: string | null) => data.teams.find((t) => t.id === id)?.name ?? '未定';
	const playerName = (id: string) => data.players.find((p) => p.id === id)?.name ?? id;
	const winnerName = (winnerTeamId: string | null) => {
		if (!winnerTeamId) return null;
		if (winnerTeamId === data.tie.teamAId) return data.teamA?.name ?? 'A側';
		if (winnerTeamId === data.tie.teamBId) return data.teamB?.name ?? 'B側';
		return null;
	};

	const lineupBySide = (side: 'A' | 'B') => data.lineups.find((l) => l.submission.side === side);
	const lineupPlayers = (rubberCode: string, side: 'A' | 'B') => {
		const sub = lineupBySide(side);
		if (!sub) return [];
		const item = sub.items.find((i) => i.rubberCode === rubberCode);
		return [item?.player1Id, item?.player2Id].filter((id): id is string => !!id);
	};

	function toRubberRow(rubber: (typeof data.rubbers)[number]): RubberRow {
		const live = (liveRubbers.current ?? []).find((r) => r.id === rubber.id);
		const status = live?.status ?? rubber.status;
		const statusSrc = live?.matchStatus ?? status;
		return {
			id: rubber.id,
			code: rubber.code,
			matchId: rubber.matchId,
			status,
			matchStatus: statusSrc,
			winnerSide: rubber.winnerSide,
			playersA: lineupPlayers(rubber.code, 'A').map(playerName),
			playersB: lineupPlayers(rubber.code, 'B').map(playerName),
			loserLabel: statusSrc === 'forfeited' ? '棄権' : statusSrc === 'retired' ? 'リタイア' : null,
			gamesScore: live?.gamesScore ?? null,
			gameDetails: live?.gameDetails ?? []
		};
	}

	let canStart = $derived(data.tie.status === 'lineup_submitted' || data.tie.status === 'ready');
	let canConfirm = $derived(data.tie.status === 'finished');

	let bothReadyToReveal = $derived(
		['submitted', 'locked'].includes(lineupBySide('A')?.submission.status ?? '') &&
			['submitted', 'locked'].includes(lineupBySide('B')?.submission.status ?? '')
	);
	let isRevealed = $derived(
		lineupBySide('A')?.submission.status === 'revealed' ||
			lineupBySide('B')?.submission.status === 'revealed'
	);

	// Workflow steps: 1=lineup_submit, 2=review, 3=start, 4=playing, 5=confirm
	let currentStep = $derived(getCurrentWorkflowStep(data.tie.status));

	let editing = $state(false);
	let skipEffect = $state(true);

	$effect(() => {
		const msg = updateTie.result?.message;
		if (skipEffect) {
			skipEffect = false;
			return;
		}
		if (msg) {
			toast.success(msg);
			editing = false;
		}
	});

	async function run(fn: () => Promise<unknown>) {
		try {
			await fn();
			await Promise.all([invalidateAll(), liveRubbers.refresh()]);
		} catch {
			// errors thrown by error() are re-thrown; redirect() also throws
		}
	}
</script>

<svelte:head>
	<title>{data.tie.tieCode} | 東大リーグ団体戦</title>
</svelte:head>

{#snippet headerActions()}
	<div class="flex flex-wrap items-center gap-3">
		<div class="flex items-center gap-2">
			<StatusBadge status={data.tie.status} />
			{#if data.tie.scheduleChanged}
				<Badge color="amber">変更あり</Badge>
			{/if}
		</div>
		<Card class="flex items-center gap-3 px-6 py-3">
			<div class="text-center">
				<div class="flex items-center gap-2">
					<span class="text-4xl font-bold tabular-nums">{data.tie.teamScoreA}</span>
					<span class="text-xl text-zinc-400">-</span>
					<span class="text-4xl font-bold tabular-nums">{data.tie.teamScoreB}</span>
				</div>
				{#if winnerName(data.tie.winnerTeamId)}
					<p class="mt-1 text-[11px] font-medium text-emerald-700">
						勝者: {winnerName(data.tie.winnerTeamId)}
					</p>
				{/if}
			</div>
		</Card>
		{#if data.tie.status === 'playing'}
			<RealtimeSync
				topics={['score']}
				onUpdate={() => liveRubbers.refresh()}
				pollInterval={10000}
			/>
		{/if}
	</div>
{/snippet}

<header>
	<a
		class="text-sm text-zinc-500 hover:text-zinc-700 inline-flex items-center gap-1"
		href={resolve('/ties')}
	>
		<ArrowLeft class="size-3" /> 対戦一覧
	</a>
	<div class="mt-2">
		<PageHeader
			title={data.tie.tieCode}
			description={`${teamName(data.tie.teamAId)} vs ${teamName(data.tie.teamBId)}`}
			actions={headerActions}
		/>
	</div>
</header>

<!-- Workflow progress -->
<Card class="p-0">
	<TieWorkflowStepper {currentStep} />
</Card>

<!-- Action buttons -->
<div class="flex flex-wrap items-center gap-2">
	{#if canStart}
		<AppButton onclick={() => run(() => startTie())}>対戦を開始</AppButton>
	{/if}

	{#if canConfirm}
		<AppButton variant="success" onclick={() => run(() => confirmTie())}>結果を確定</AppButton>
	{/if}

	<span class="ml-auto">
		<ConfirmDialog
			onConfirm={async () => {
				try {
					await deleteTie();
				} catch {
					// redirect throws
				}
			}}
			triggerLabel="対戦を削除"
			triggerClass="text-xs text-red-500 hover:text-red-700 hover:underline"
			triggerVariant="ghost"
			title="対戦を削除しますか？"
			description={`「${data.tie.tieCode}」を削除します。種目やオーダーのデータもすべて削除されます。この操作は取り消せません。`}
			confirmVariant="danger"
			confirmLabel="削除する"
		/>
	</span>
</div>

<!-- Info / edit panel -->
<Card>
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-xs font-medium tracking-wide text-zinc-400">詳細情報</h2>
		{#if !editing}
			<AppButton size="sm" variant="secondary" onclick={() => (editing = true)}>編集</AppButton>
		{/if}
	</div>

	{#if editing}
		<form {...updateTie} class="space-y-4">
			<TieEditForm tie={data.tie} teams={data.teams} />
			<div class="flex items-center gap-3 pt-1">
				<AppButton type="submit" variant="primary">保存</AppButton>
				<AppButton type="button" variant="secondary" onclick={() => (editing = false)}>
					キャンセル
				</AppButton>
			</div>
		</form>
	{:else}
		<dl class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
			<div>
				<dt class="text-xs text-zinc-500">コード</dt>
				<dd class="mt-0.5 font-medium">{data.tie.tieCode}</dd>
			</div>
			<div>
				<dt class="text-xs text-zinc-500">ラウンド</dt>
				<dd class="mt-0.5">{phaseLabel(data.tie.phase)}</dd>
			</div>
			<div>
				<dt class="text-xs text-zinc-500">状態</dt>
				<dd class="mt-0.5">{tieStatusLabel(data.tie.status)}</dd>
			</div>
			<div>
				<dt class="text-xs text-zinc-500">変更あり</dt>
				<dd class="mt-0.5">{data.tie.scheduleChanged ? 'はい' : 'なし'}</dd>
			</div>
			<div>
				<dt class="text-xs text-zinc-500">予定時刻</dt>
				<dd class="mt-0.5">{data.tie.scheduledStartAt ?? '—'}</dd>
			</div>
			<div>
				<dt class="text-xs text-zinc-500">体育館・コート</dt>
				<dd class="mt-0.5">
					{data.tie.venue || data.tie.courtBlockCode
						? courtDisplayLabel(data.tie.venue, data.tie.courtBlockCode)
						: '—'}
				</dd>
			</div>
			<div>
				<dt class="text-xs text-zinc-500">オーダー期限</dt>
				<dd class="mt-0.5">{data.tie.lineupDueAt ?? '—'}</dd>
			</div>
			{#if data.teams.length > 0}
				<div>
					<dt class="text-xs text-zinc-500">審判担当</dt>
					<dd class="mt-0.5">
						{data.tie.officiatingTeamIds.length > 0
							? data.tie.officiatingTeamIds.map(teamName).join('、')
							: '未割当'}
					</dd>
				</div>
			{/if}
			{#if data.tie.operationNote}
				<div class="sm:col-span-2 lg:col-span-4">
					<dt class="text-xs text-zinc-500">運営メモ</dt>
					<dd class="mt-0.5 whitespace-pre-wrap">{data.tie.operationNote}</dd>
				</div>
			{/if}
			{#if data.teams.length > 0 && data.tie.officiatingNote}
				<div class="sm:col-span-2 lg:col-span-4">
					<dt class="text-xs text-zinc-500">審判メモ</dt>
					<dd class="mt-0.5 whitespace-pre-wrap">{data.tie.officiatingNote}</dd>
				</div>
			{/if}
		</dl>
	{/if}
</Card>

<!-- Steps 1-2: Lineup panels -->
{#if currentStep <= 2}
	<!-- Reveal / unreveal -->
	{#if isRevealed || bothReadyToReveal}
		<Card class="flex items-center justify-between px-5 py-3">
			<p class="text-sm text-zinc-500">両チームのオーダーが揃っています。</p>
			{#if isRevealed}
				<AppButton variant="secondary" onclick={() => run(() => unrevealLineups())}>
					公開を取り消す
				</AppButton>
			{:else}
				<AppButton onclick={() => run(() => revealLineups())}>オーダー公開</AppButton>
			{/if}
		</Card>
	{/if}

	<!-- Per-team lineup panels -->
	<div class="grid gap-5 lg:grid-cols-2">
		{@render lineupPanel('A', data.teamA, data.tie.teamAId)}
		{@render lineupPanel('B', data.teamB, data.tie.teamBId)}
	</div>

	<!-- Steps 3+: Rubber results -->
{:else}
	<TieResultsSection
		rubbers={data.rubbers.map(toRubberRow)}
		teamAName={teamName(data.tie.teamAId)}
		teamBName={teamName(data.tie.teamBId)}
		onConfirmMatch={(matchId) => run(() => confirmMatch({ matchId }))}
		onUnconfirmMatch={(matchId) => run(() => unconfirmMatch({ matchId }))}
	/>
{/if}

{#snippet lineupPanel(side: 'A' | 'B', team: EntityOption | null, teamId: string | null)}
	{@const lineup = lineupBySide(side)}
	{@const subStatus = lineup?.submission.status ?? null}
	<Card class="overflow-hidden" flush>
		<!-- Panel header -->
		<div class="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
			<div class="flex items-center gap-3">
				<h2 class="text-base font-semibold">{team?.name ?? (side === 'A' ? 'A側' : 'B側')}</h2>
				<Badge color={submissionBadgeColor(subStatus)}>
					{submissionStatusLabel(subStatus)}
				</Badge>
			</div>
			<div class="flex items-center gap-2">
				<!-- Link to team input page -->
				{#if teamId}
					<AppButton
						variant="secondary"
						size="sm"
						href={resolve('/ties/[tieId]/lineups/[teamId]', { tieId: data.tie.id, teamId })}
					>
						入力ページ
					</AppButton>
				{/if}
				{#if (subStatus === 'locked' || subStatus === 'revealed') && !isRevealed}
					{#if teamId}
						<ConfirmDialog
							onConfirm={() => run(() => unlockLineup({ teamId: teamId! }))}
							triggerLabel="承認を解除"
							triggerClass="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
							title="オーダーの承認を解除しますか？"
							description={`${team?.name ?? side + '側'}のオーダー承認を解除します。チームはオーダーを再編集・再提出できるようになります。`}
							confirmLabel="承認を解除する"
							confirmVariant="warning"
							confirmClass="border border-amber-300"
						/>
					{/if}
				{:else if subStatus === 'submitted'}
					{#if teamId}
						<AppButton
							variant="violet"
							size="sm"
							onclick={() => run(() => lockLineup({ teamId: teamId! }))}
						>
							承認する
						</AppButton>
					{/if}
				{/if}
			</div>
		</div>

		<!-- Lineup content -->
		{#if !lineup || subStatus === 'draft' || lineup.items.length === 0}
			<div class="px-5 py-8 text-center">
				<p class="text-sm text-zinc-400">{!lineup ? '未提出' : '下書き中'}</p>
			</div>
		{:else}
			<div class="divide-y divide-zinc-100">
				{#each RUBBER_DEFINITIONS as rubber (rubber.code)}
					{@const item = lineup.items.find((i) => i.rubberCode === rubber.code)}
					<div class="grid grid-cols-[6rem_1fr] gap-3 px-5 py-3.5 sm:grid-cols-[8rem_1fr]">
						<p class="pt-0.5 text-xs font-medium text-zinc-500">{rubberLabel(rubber.code)}</p>
						<div class="min-w-0 space-y-0.5">
							{#if item?.player1Id}
								<p class="truncate text-sm">{playerName(item.player1Id)}</p>
							{:else}
								<p class="text-sm text-zinc-400">未入力</p>
							{/if}
							{#if item?.player2Id}
								<p class="truncate text-sm">{playerName(item.player2Id)}</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</Card>
{/snippet}
