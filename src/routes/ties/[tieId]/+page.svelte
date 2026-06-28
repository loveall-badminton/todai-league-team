<script lang="ts">
	import RealtimeSync from '$lib/components/RealtimeSync.svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import AppButton from '$lib/components/AppButton.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Card from '$lib/components/Card.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import type { RubberRow } from '$lib/types/entities';
	import { RUBBER_DEFINITIONS } from '$lib/domain/tokyoLeague';
	import {
		courtDisplayLabel,
		phaseLabel,
		rubberLabel,
		rubberStatusLabel,
		submissionStatusLabel,
		tieStatusLabel
	} from '$lib/domain/tokyoLeagueLabels';
	import type { EntityOption } from '$lib/types/entities';
	import { ArrowLeft } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import TieEditForm from '$lib/components/TieEditForm.svelte';
	import {
		confirmMatch,
		confirmTie,
		deleteTie,
		getLiveRubbers,
		getTieHeader,
		getTieLineups,
		lockLineup,
		revealLineups,
		startTie,
		unconfirmMatch,
		unlockLineup,
		unrevealLineups
	} from './tie.remote';
	import {
		rubberStatusTextClass,
		submissionBadgeColor,
		getCurrentWorkflowStep
	} from './tiePageHelpers';
	import TieWorkflowStepper from './TieWorkflowStepper.svelte';
	import TieRubberList from '$lib/components/TieRubberList.svelte';
	import TieNotifyPanel from '$lib/components/TieNotifyPanel.svelte';
	import { createRealtimeQueryFlow } from '$lib/realtime/queryFlow';
	import {
		shouldRefreshTieHeaderData,
		shouldRefreshTieLiveRubbers,
		shouldRefreshTieLineups,
		type RealtimeUpdate
	} from '$lib/realtime/updates';

	const tieId = page.params.tieId!;
	const liveRubbers = getLiveRubbers(tieId);
	const tieHeaderQuery = getTieHeader(tieId);
	const tieLineupsQuery = getTieLineups(tieId);
	const [initialTieHeader, initialTieLineups] = await Promise.all([
		tieHeaderQuery,
		tieLineupsQuery
	]);
	let tieHeader = $derived(tieHeaderQuery.current ?? initialTieHeader);
	let tieLineups = $derived(tieLineupsQuery.current ?? initialTieLineups);
	let tie = $derived(tieHeader.tie);
	let rubbers = $derived(tieHeader.rubbers);
	let teams = $derived(tieHeader.teams);
	let lineups = $derived(tieLineups.lineups);
	let players = $derived(tieLineups.players);
	let teamA = $derived(tieHeader.teamA);
	let teamB = $derived(tieHeader.teamB);

	const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? '未定';
	const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? id;
	const winnerName = (winnerTeamId: string | null) => {
		if (!winnerTeamId) return null;
		if (winnerTeamId === tie.teamAId) return teamA?.name ?? 'A側';
		if (winnerTeamId === tie.teamBId) return teamB?.name ?? 'B側';
		return null;
	};

	const lineupBySide = (side: 'A' | 'B') => lineups.find((l) => l.submission.side === side);
	const lineupPlayers = (rubberCode: string, side: 'A' | 'B') => {
		const sub = lineupBySide(side);
		if (!sub) return [];
		const item = sub.items.find((i) => i.rubberCode === rubberCode);
		return [item?.player1Id, item?.player2Id].filter((id): id is string => !!id);
	};

	function toRubberRow(rubber: (typeof rubbers)[number]): RubberRow {
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

	let canStart = $derived(tie.status === 'lineup_submitted' || tie.status === 'ready');
	let canConfirm = $derived(tie.status === 'finished');
	let realtimeTopics = $derived(
		tie.status === 'playing' ? (['score', 'schedule'] as const) : (['schedule'] as const)
	);

	let bothReadyToReveal = $derived(
		['submitted', 'locked'].includes(lineupBySide('A')?.submission.status ?? '') &&
			['submitted', 'locked'].includes(lineupBySide('B')?.submission.status ?? '')
	);
	let isRevealed = $derived(
		lineupBySide('A')?.submission.status === 'revealed' ||
			lineupBySide('B')?.submission.status === 'revealed'
	);

	// Workflow steps: 1=lineup_submit, 2=review, 3=start, 4=playing, 5=confirm
	let currentStep = $derived(getCurrentWorkflowStep(tie.status));

	let editing = $state(false);

	const rubberStatusBgClass = rubberStatusTextClass;

	type RefreshTarget = 'header' | 'lineups' | 'rubbers';

	async function run(
		fn: () => Promise<void>,
		targets: RefreshTarget[] = ['header', 'lineups', 'rubbers']
	) {
		try {
			await fn();
			const refreshes = [];
			if (targets.includes('header')) refreshes.push(tieHeaderQuery.refresh());
			if (targets.includes('lineups')) refreshes.push(tieLineupsQuery.refresh());
			if (targets.includes('rubbers')) refreshes.push(liveRubbers.refresh());
			await Promise.all(refreshes);
		} catch {
			toast.error('操作に失敗しました');
		}
	}

	const handleTieHeaderUpdate = createRealtimeQueryFlow({
		refresh: () => tieHeaderQuery.refresh(),
		shouldRefresh: (update: RealtimeUpdate) => shouldRefreshTieHeaderData(update, tie.id)
	});

	const handleTieLineupsUpdate = createRealtimeQueryFlow({
		refresh: () => tieLineupsQuery.refresh(),
		shouldRefresh: (update: RealtimeUpdate) => shouldRefreshTieLineups(update, tie.id)
	});

	const handleLiveRubbersUpdate = createRealtimeQueryFlow({
		refresh: () => liveRubbers.refresh(),
		shouldRefresh: (update: RealtimeUpdate) =>
			shouldRefreshTieLiveRubbers(
				update,
				tie.id,
				rubbers.map((rubber) => rubber.matchId).filter((id): id is string => !!id)
			)
	});
</script>

<svelte:head>
	<title>{tie.tieCode} | 東大リーグ団体戦</title>
</svelte:head>

{#snippet headerActions()}
	<div class="flex flex-wrap items-center gap-3">
		<div class="flex items-center gap-2">
			<StatusBadge status={tie.status} />
			{#if tie.scheduleChanged}
				<Badge color="amber">変更あり</Badge>
			{/if}
		</div>
		<Card class="flex items-center gap-3">
			<div class="text-center">
				<div class="flex items-center gap-2">
					<span class="text-4xl font-bold tabular-nums">{tie.teamScoreA}</span>
					<span class="text-xl text-muted">-</span>
					<span class="text-4xl font-bold tabular-nums">{tie.teamScoreB}</span>
				</div>
				{#if winnerName(tie.winnerTeamId)}
					<p class="mt-1 text-[11px] font-medium text-emerald-700">
						勝者: {winnerName(tie.winnerTeamId)}
					</p>
				{/if}
			</div>
		</Card>
		<RealtimeSync
			topics={realtimeTopics}
			onUpdate={(u) => {
				void handleTieHeaderUpdate(u);
				void handleTieLineupsUpdate(u);
				void handleLiveRubbersUpdate(u);
			}}
			pollInterval={10000}
		/>
	</div>
{/snippet}

<header>
	<a
		class="text-sm text-muted-foreground hover:text-zinc-700 inline-flex items-center gap-1"
		href={resolve('/ties')}
	>
		<ArrowLeft class="size-3" /> 対戦一覧
	</a>
	<div class="mt-2">
		<PageHeader
			title={tie.tieCode}
			description={`${teamName(tie.teamAId)} vs ${teamName(tie.teamBId)}`}
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
		<AppButton onclick={() => run(() => startTie(), ['header', 'rubbers'])}>対戦を開始</AppButton>
	{/if}

	{#if canConfirm}
		<AppButton variant="success" onclick={() => run(() => confirmTie(), ['header'])}
			>結果を確定</AppButton
		>
	{/if}

	<span class="ml-auto">
		<ConfirmDialog
			onConfirm={async () => {
				await deleteTie();
				goto(resolve('/ties'));
			}}
			triggerLabel="対戦を削除"
			triggerClass="text-xs text-red-500 hover:text-red-700 hover:underline"
			triggerVariant="ghost"
			title="対戦を削除しますか？"
			description={`「${tie.tieCode}」を削除します。種目やオーダーのデータもすべて削除されます。この操作は取り消せません。`}
			confirmVariant="danger"
			confirmLabel="削除する"
		/>
	</span>
</div>

<!-- Info / edit panel -->
<Card>
	{#snippet header()}
		<h2 class="text-xs font-medium tracking-wide text-muted">詳細情報</h2>
		{#if !editing}
			<AppButton size="sm" variant="secondary" onclick={() => (editing = true)}>編集</AppButton>
		{/if}
	{/snippet}

	{#if editing}
		<TieEditForm
			{tie}
			id={tie.id}
			{teams}
			onSaved={() => {
				editing = false;
				void tieHeaderQuery.refresh();
			}}
		>
			<div class="flex items-center gap-3 pt-1">
				<AppButton type="submit" variant="primary">保存</AppButton>
				<AppButton type="button" variant="secondary" onclick={() => (editing = false)}>
					キャンセル
				</AppButton>
			</div>
		</TieEditForm>
	{:else}
		<dl class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
			<div>
				<dt class="text-xs text-muted-foreground">コード</dt>
				<dd class="mt-0.5 font-medium">{tie.tieCode}</dd>
			</div>
			<div>
				<dt class="text-xs text-muted-foreground">ラウンド</dt>
				<dd class="mt-0.5">{phaseLabel(tie.phase)}</dd>
			</div>
			<div>
				<dt class="text-xs text-muted-foreground">状態</dt>
				<dd class="mt-0.5">{tieStatusLabel(tie.status)}</dd>
			</div>
			<div>
				<dt class="text-xs text-muted-foreground">変更あり</dt>
				<dd class="mt-0.5">{tie.scheduleChanged ? 'はい' : 'なし'}</dd>
			</div>
			<div>
				<dt class="text-xs text-muted-foreground">予定時刻</dt>
				<dd class="mt-0.5">{tie.scheduledStartAt ?? '—'}</dd>
			</div>
			<div>
				<dt class="text-xs text-muted-foreground">体育館・コート</dt>
				<dd class="mt-0.5">
					{tie.venue || tie.courtBlockCode ? courtDisplayLabel(tie.venue, tie.courtBlockCode) : '—'}
				</dd>
			</div>
			<div>
				<dt class="text-xs text-muted-foreground">オーダー期限</dt>
				<dd class="mt-0.5">{tie.lineupDueAt ?? '—'}</dd>
			</div>
			{#if teams.length > 0}
				<div>
					<dt class="text-xs text-muted-foreground">審判担当</dt>
					<dd class="mt-0.5">
						{tie.officiatingTeamIds.length > 0
							? tie.officiatingTeamIds.map(teamName).join('、')
							: '未割当'}
					</dd>
				</div>
			{/if}
			{#if tie.operationNote}
				<div class="sm:col-span-2 lg:col-span-4">
					<dt class="text-xs text-muted-foreground">運営メモ</dt>
					<dd class="mt-0.5 whitespace-pre-wrap">{tie.operationNote}</dd>
				</div>
			{/if}
			{#if teams.length > 0 && tie.officiatingNote}
				<div class="sm:col-span-2 lg:col-span-4">
					<dt class="text-xs text-muted-foreground">審判メモ</dt>
					<dd class="mt-0.5 whitespace-pre-wrap">{tie.officiatingNote}</dd>
				</div>
			{/if}
		</dl>
	{/if}
</Card>

<!-- Steps 1-2: Lineup panels -->
{#if currentStep <= 2}
	<!-- Reveal / unreveal -->
	{#if isRevealed || bothReadyToReveal}
		<Card innerClass="flex items-center justify-between gap-2">
			<p class="text-sm text-muted-foreground">両チームのオーダーが揃っています。</p>
			{#if isRevealed}
				<AppButton
					variant="secondary"
					onclick={() => run(() => unrevealLineups(), ['header', 'lineups'])}
				>
					公開を取り消す
				</AppButton>
			{:else}
				<AppButton onclick={() => run(() => revealLineups(), ['header', 'lineups'])}>
					オーダー公開
				</AppButton>
			{/if}
		</Card>
	{/if}

	<!-- Per-team lineup panels -->
	<div class="grid gap-5 lg:grid-cols-2">
		{@render lineupPanel('A', teamA, tie.teamAId)}
		{@render lineupPanel('B', teamB, tie.teamBId)}
	</div>

	<!-- Steps 3+: Rubber results -->
{:else}
	{#snippet rubberExtraHead()}
		<th class="w-24 px-4 py-3 text-left text-xs font-medium text-muted">状態</th>
		<th class="w-32 px-4 py-3 text-left text-xs font-medium text-muted">操作</th>
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
					<span class="text-xs text-muted">—</span>
				{/if}
				{#if row.matchId && row.matchStatus === 'confirmed'}
					<ConfirmDialog
						onConfirm={async () => {
							await unconfirmMatch({ matchId: row.matchId! });
						}}
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
						onConfirm={async () => {
							await confirmMatch({ matchId: row.matchId! });
						}}
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

	<Card flush class="overflow-hidden">
		{#snippet header()}
			<h2 class="font-semibold">種目別結果</h2>
		{/snippet}
		<TieRubberList
			rubbers={rubbers.map(toRubberRow)}
			teamAName={teamName(tie.teamAId)}
			teamBName={teamName(tie.teamBId)}
			variant="table"
			extraHead={rubberExtraHead}
			extraCell={rubberExtraCell}
		/>
	</Card>
{/if}

<TieNotifyPanel
	{tie}
	teamAName={teamA?.name ?? null}
	teamBName={teamB?.name ?? null}
	rubbers={rubbers.map(toRubberRow)}
/>

{#snippet lineupPanel(side: 'A' | 'B', team: EntityOption | null, teamId: string | null)}
	{@const lineup = lineupBySide(side)}
	{@const subStatus = lineup?.submission.status ?? null}
	<Card class="overflow-hidden" flush>
		<!-- Panel header -->
		<div class="flex items-center justify-between border-b border-border-subtle px-5 py-4">
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
						href={resolve('/ties/[tieId]/lineups/[teamId]', { tieId: tie.id, teamId })}
					>
						入力ページ
					</AppButton>
				{/if}
				{#if (subStatus === 'locked' || subStatus === 'revealed') && !isRevealed}
					{#if teamId}
						<ConfirmDialog
							onConfirm={() => run(() => unlockLineup({ teamId: teamId! }), ['header', 'lineups'])}
							triggerLabel="承認を解除"
							triggerClass="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted-emphasis hover:bg-zinc-50"
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
							onclick={() => run(() => lockLineup({ teamId: teamId! }), ['header', 'lineups'])}
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
				<p class="text-sm text-muted">{!lineup ? '未提出' : '下書き中'}</p>
			</div>
		{:else}
			<div class="divide-y divide-zinc-100">
				{#each RUBBER_DEFINITIONS as rubber (rubber.code)}
					{@const item = lineup.items.find((i) => i.rubberCode === rubber.code)}
					<div class="grid grid-cols-[6rem_1fr] gap-3 px-5 py-3.5 sm:grid-cols-[8rem_1fr]">
						<p class="pt-0.5 text-xs font-medium text-muted-foreground">
							{rubberLabel(rubber.code)}
						</p>
						<div class="min-w-0 space-y-0.5">
							{#if item?.player1Id}
								<p class="truncate text-sm">{playerName(item.player1Id)}</p>
							{:else}
								<p class="text-sm text-muted">未入力</p>
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
