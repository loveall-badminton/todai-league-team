<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AppButton from '$lib/components/AppButton.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Card from '$lib/components/Card.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import DeleteConfirmDialog from '$lib/components/DeleteConfirmDialog.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import type { RubberRow } from '$lib/components/TieRubberList.svelte';
	import TieRubberList from '$lib/components/TieRubberList.svelte';
	import { RUBBER_DEFINITIONS } from '$lib/domain/tokyoLeague';
	import {
		courtDisplayLabel,
		phaseLabel,
		rubberLabel,
		rubberStatusLabel,
		submissionStatusLabel,
		tieStatusLabel
	} from '$lib/domain/tokyoLeagueLabels';
	import { cn } from '$lib/utils/cn';
	import { Check } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import TieEditForm from '$lib/components/TieEditForm.svelte';
	import type { PageProps } from './$types';
	import {
		confirmTie,
		deleteTie,
		getLiveRubbers,
		lockLineup,
		revealLineups,
		startTie,
		unlockLineup,
		unrevealLineups,
		updateTie
	} from './tie.remote';

	let { data }: PageProps = $props();

	const liveRubbers = getLiveRubbers();

	$effect(() => {
		if (data.tie.status !== 'playing') return;
		const id = setInterval(() => liveRubbers.refresh(), 10000);
		return () => clearInterval(id);
	});

	const teamName = (id: string | null) => data.teams.find((t) => t.id === id)?.name ?? '未定';
	const playerName = (id: string) => data.players.find((p) => p.id === id)?.name ?? id;
	const winnerName = (winnerTeamId: string | null) => {
		if (!winnerTeamId) return null;
		if (winnerTeamId === data.tie.teamAId) return data.teamA?.name ?? 'A側';
		if (winnerTeamId === data.tie.teamBId) return data.teamB?.name ?? 'B側';
		return null;
	};

	const rubberStatusBgClass = (s: string) =>
		({
			not_ready: 'text-zinc-400',
			ready: 'text-violet-600',
			scheduled: 'text-zinc-600',
			playing: 'text-green-700 font-medium',
			finished: 'text-orange-700',
			confirmed: 'text-emerald-700 font-medium',
			skipped: 'text-zinc-400',
			cancelled: 'text-red-600'
		})[s] ?? 'text-zinc-500';

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
			winnerSide: rubber.winnerSide,
			playersA: lineupPlayers(rubber.code, 'A').map(playerName),
			playersB: lineupPlayers(rubber.code, 'B').map(playerName),
			loserLabel: statusSrc === 'forfeited' ? '棄権' : statusSrc === 'retired' ? 'リタイア' : null,
			gamesScore: live?.gamesScore ?? null,
			gameDetails: live?.gameDetails ?? []
		};
	}

	const submissionBadgeColor = (status: string | null | undefined) => {
		const map: Record<string, 'zinc' | 'blue' | 'violet' | 'emerald'> = {
			draft: 'zinc',
			submitted: 'blue',
			locked: 'violet',
			revealed: 'emerald'
		};
		return status ? (map[status] ?? 'zinc') : 'zinc';
	};

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
	let currentStep = $derived(
		data.tie.status === 'scheduled' || data.tie.status === 'lineup_pending'
			? 1
			: data.tie.status === 'lineup_submitted'
				? 2
				: data.tie.status === 'ready'
					? 3
					: data.tie.status === 'playing'
						? 4
						: data.tie.status === 'finished'
							? 5
							: data.tie.status === 'confirmed'
								? 5
								: 0
	);

	const workflowSteps = [
		{ label: 'オーダー提出', desc: '各チームが選手を登録' },
		{ label: 'オーダー確認', desc: '運営が内容を確認' },
		{ label: '試合開始', desc: '審判・コートを割り当て' },
		{ label: '試合進行', desc: '審判がスコアを入力' },
		{ label: '結果確定', desc: '運営が結果を承認' }
	];

	let editing = $state(false);

	$effect(() => {
		const msg = updateTie.result?.message;
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
	</div>
{/snippet}

<header>
	<a class="text-sm text-zinc-500 hover:text-zinc-700" href={resolve('/ties')}> ← 対戦一覧 </a>
	<div class="mt-2">
		<PageHeader
			title={data.tie.tieCode}
			description={`${teamName(data.tie.teamAId)} vs ${teamName(data.tie.teamBId)}`}
			actions={headerActions}
		/>
	</div>
</header>

<!-- Workflow progress -->
<Card class="px-5 py-4">
	<div class="flex items-start gap-0 overflow-x-auto">
		{#each workflowSteps as step, i (i)}
			{@const stepNum = i + 1}
			{@const isComplete = currentStep > stepNum}
			{@const isCurrent = currentStep === stepNum}
			<div class="flex min-w-28 flex-1 flex-col items-center gap-1.5 text-center">
				<div class="flex w-full items-center">
					<div
						class={cn(
							'mt-1.5 h-px flex-1',
							i === 0 ? 'invisible' : isComplete || isCurrent ? 'bg-zinc-900' : 'bg-zinc-200'
						)}
					></div>
					<div
						class={cn(
							'mt-1.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
							isComplete
								? 'bg-zinc-900 text-white'
								: isCurrent
									? 'bg-zinc-900 text-white ring-4 ring-zinc-200'
									: 'border-2 border-zinc-200 text-zinc-400'
						)}
					>
						{#if isComplete}<Check class="size-4" />{:else}{stepNum}{/if}
					</div>
					<div
						class={cn(
							'mt-1.5 h-px flex-1',
							i === workflowSteps.length - 1
								? 'invisible'
								: isComplete
									? 'bg-zinc-900'
									: 'bg-zinc-200'
						)}
					></div>
				</div>
				<p
					class={cn(
						'text-xs font-medium',
						isCurrent ? 'text-zinc-950' : isComplete ? 'text-zinc-500' : 'text-zinc-300'
					)}
				>
					{step.label}
				</p>
				{#if isCurrent}
					<p class="text-[10px] text-zinc-500">{step.desc}</p>
				{/if}
			</div>
		{/each}
	</div>
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
		<DeleteConfirmDialog
			onConfirm={async () => {
				try {
					await deleteTie();
				} catch {
					// redirect throws
				}
			}}
			triggerLabel="対戦を削除"
			title="対戦を削除しますか？"
			description={`「${data.tie.tieCode}」を削除します。種目やオーダーのデータもすべて削除されます。この操作は取り消せません。`}
		/>
	</span>
</div>

<!-- Info / edit panel -->
<Card class="p-5">
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
						{data.tie.officiatingTeamId ? teamName(data.tie.officiatingTeamId) : '未割当'}
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
		</td>
	{/snippet}

	<Card>
		<div class="border-b border-zinc-100 px-5 py-4">
			<h2 class="font-semibold">種目別結果</h2>
		</div>
		<TieRubberList
			rubbers={data.rubbers.map(toRubberRow)}
			teamAName={teamName(data.tie.teamAId)}
			teamBName={teamName(data.tie.teamBId)}
			variant="table"
			extraHead={rubberExtraHead}
			extraCell={rubberExtraCell}
		/>
	</Card>
{/if}

{#snippet lineupPanel(
	side: 'A' | 'B',
	team: { id: string; name: string } | null,
	teamId: string | null
)}
	{@const lineup = lineupBySide(side)}
	{@const subStatus = lineup?.submission.status ?? null}
	<Card class="overflow-hidden">
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
							confirmClass="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 transition-colors"
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
					<div class="grid grid-cols-[8rem_1fr] gap-3 px-5 py-3.5">
						<p class="pt-0.5 text-xs font-medium text-zinc-500">{rubberLabel(rubber.code)}</p>
						<div class="space-y-0.5">
							{#if item?.player1Id}
								<p class="text-sm">{playerName(item.player1Id)}</p>
							{:else}
								<p class="text-sm text-zinc-400">未入力</p>
							{/if}
							{#if item?.player2Id}
								<p class="text-sm">{playerName(item.player2Id)}</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</Card>
{/snippet}
