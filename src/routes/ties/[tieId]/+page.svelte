<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { RUBBER_DEFINITIONS } from '$lib/domain/tokyoLeague';
	import {
		courtDisplayLabel,
		phaseLabel,
		rubberLabel,
		rubberStatusLabel,
		submissionStatusLabel,
		tieStatusLabel
	} from '$lib/domain/tokyoLeagueLabels';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import DeleteConfirmDialog from '$lib/components/DeleteConfirmDialog.svelte';
	import type { PageProps } from './$types';
	import {
		startTie,
		confirmTie,
		lockLineup,
		unlockLineup,
		revealLineups,
		unrevealLineups,
		deleteTie
	} from './tie.remote';

	let { data }: PageProps = $props();

	// Auto-refresh when tie is active
	$effect(() => {
		if (data.tie.status !== 'playing') return;
		const interval = setInterval(() => invalidateAll(), 10000);
		return () => clearInterval(interval);
	});

	const teamName = (id: string | null) => data.teams.find((t) => t.id === id)?.name ?? '未定';
	const playerName = (id: string) => data.players.find((p) => p.id === id)?.name ?? id;

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

	const submissionBadgeClass = (status: string | null | undefined) => {
		const map: Record<string, string> = {
			draft: 'bg-zinc-100 text-zinc-600',
			submitted: 'bg-blue-100 text-blue-700',
			locked: 'bg-violet-100 text-violet-700',
			revealed: 'bg-emerald-100 text-emerald-700'
		};
		return status ? (map[status] ?? 'bg-zinc-100 text-zinc-500') : 'bg-zinc-100 text-zinc-400';
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

	// Workflow steps: 1=lineup submit, 2=review, 3=start, 4=playing, 5=confirm
	let currentStep = $derived(
		data.tie.status === 'scheduled' || data.tie.status === 'lineup_pending'
			? 1
			: data.tie.status === 'lineup_submitted' || data.tie.status === 'ready'
				? 2
				: data.tie.status === 'playing'
					? 3
					: data.tie.status === 'finished'
						? 4
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

	async function run(fn: () => Promise<unknown>) {
		try {
			await fn();
			await invalidateAll();
		} catch {
			// errors thrown by error() are re-thrown; redirect() also throws
		}
	}
</script>

<svelte:head>
	<title>{data.tie.tieCode} | 東大リーグ団体戦</title>
</svelte:head>

<div class="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-950 sm:px-6">
	<div class="space-y-6">
		<!-- Header -->
		<header>
			<a class="text-sm text-zinc-500 hover:text-zinc-700" href={resolve('/ties')}> ← 対戦一覧 </a>
			<div class="mt-2 flex flex-wrap items-start justify-between gap-4">
				<div>
					<div class="flex flex-wrap items-center gap-3">
						<h1 class="text-2xl font-semibold tracking-tight">{data.tie.tieCode}</h1>
						<StatusBadge status={data.tie.status} />
						{#if data.tie.scheduleChanged}
							<span class="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
								変更あり
							</span>
						{/if}
					</div>
					<p class="mt-1 text-base text-zinc-600">
						{teamName(data.tie.teamAId)} vs {teamName(data.tie.teamBId)}
					</p>
				</div>

				<!-- Score display -->
				<div
					class="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-6 py-3 shadow-sm"
				>
					<span class="text-4xl font-bold tabular-nums">{data.tie.teamScoreA}</span>
					<span class="text-xl text-zinc-400">-</span>
					<span class="text-4xl font-bold tabular-nums">{data.tie.teamScoreB}</span>
				</div>
			</div>
		</header>

		<!-- Workflow progress -->
		<section class="rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
			<div class="flex items-start gap-0 overflow-x-auto">
				{#each workflowSteps as step, i (i)}
					{@const stepNum = i + 1}
					{@const isComplete = currentStep > stepNum}
					{@const isCurrent = currentStep === stepNum}
					<div class="flex min-w-28 flex-1 flex-col items-center gap-1.5 text-center">
						<div class="flex w-full items-center">
							<div
								class="h-px flex-1 {i === 0
									? 'invisible'
									: isComplete || isCurrent
										? 'bg-zinc-900'
										: 'bg-zinc-200'}"
							></div>
							<div
								class="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold
								{isComplete
									? 'bg-zinc-900 text-white'
									: isCurrent
										? 'bg-zinc-900 text-white ring-4 ring-zinc-200'
										: 'border-2 border-zinc-200 text-zinc-400'}"
							>
								{#if isComplete}✓{:else}{stepNum}{/if}
							</div>
							<div
								class="h-px flex-1 {i === workflowSteps.length - 1
									? 'invisible'
									: isComplete
										? 'bg-zinc-900'
										: 'bg-zinc-200'}"
							></div>
						</div>
						<p
							class="text-xs font-medium {isCurrent
								? 'text-zinc-950'
								: isComplete
									? 'text-zinc-500'
									: 'text-zinc-300'}"
						>
							{step.label}
						</p>
						{#if isCurrent}
							<p class="text-[10px] text-zinc-500">{step.desc}</p>
						{/if}
					</div>
				{/each}
			</div>
		</section>

		<!-- Action buttons -->
		<div class="flex flex-wrap items-center gap-2">
			{#if canStart}
				<button
					class="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
					onclick={() => run(() => startTie())}
				>
					対戦を開始
				</button>
			{/if}

			{#if canConfirm}
				<button
					class="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
					onclick={() => run(() => confirmTie())}
				>
					結果を確定
				</button>
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

		<!-- Info grid -->
		<section class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
			<h2 class="mb-4 text-xs font-medium tracking-wide text-zinc-400">詳細情報</h2>
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<div>
					<p class="text-xs font-medium text-zinc-500">ラウンド</p>
					<p class="mt-0.5 font-medium">{phaseLabel(data.tie.phase)}</p>
				</div>
				<div>
					<p class="text-xs font-medium text-zinc-500">状態</p>
					<p class="mt-0.5 font-medium">{tieStatusLabel(data.tie.status)}</p>
				</div>
				<div>
					<p class="text-xs font-medium text-zinc-500">予定時刻</p>
					<p class="mt-0.5 font-medium">{data.tie.scheduledStartAt ?? '未設定'}</p>
				</div>
				<div>
					<p class="text-xs font-medium text-zinc-500">体育館・コート</p>
					<p class="mt-0.5 font-medium">
						{courtDisplayLabel(data.tie.venue, data.tie.courtBlockCode)}
					</p>
				</div>
				<div>
					<p class="text-xs font-medium text-zinc-500">オーダー提出期限</p>
					<p class="mt-0.5 font-medium">{data.tie.lineupDueAt ?? '未設定'}</p>
				</div>
				<div>
					<p class="text-xs font-medium text-zinc-500">オーダー公開</p>
					<p class="mt-0.5 font-medium">{data.tie.lineupsRevealedAt ? '公開済' : '未公開'}</p>
				</div>
				{#if data.tie.operationNote}
					<div class="sm:col-span-2 lg:col-span-3">
						<p class="text-xs font-medium text-zinc-500">運営メモ</p>
						<p class="mt-0.5 text-sm text-zinc-700">{data.tie.operationNote}</p>
					</div>
				{/if}
			</div>
		</section>

		<!-- Steps 1-2: Lineup panels -->
		{#if currentStep <= 2}
			<!-- Reveal / unreveal -->
			{#if isRevealed || bothReadyToReveal}
				<div
					class="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-3 shadow-sm"
				>
					<p class="text-sm text-zinc-500">両チームのオーダーが揃っています。</p>
					{#if isRevealed}
						<button
							class="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
							onclick={() => run(() => unrevealLineups())}
						>
							公開を取り消す
						</button>
					{:else}
						<button
							class="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
							onclick={() => run(() => revealLineups())}
						>
							オーダー公開
						</button>
					{/if}
				</div>
			{/if}

			<!-- Per-team lineup panels -->
			<div class="grid gap-5 lg:grid-cols-2">
				{@render lineupPanel('A', data.teamA, data.tie.teamAId)}
				{@render lineupPanel('B', data.teamB, data.tie.teamBId)}
			</div>

			<!-- Steps 3+: Rubber results -->
		{:else}
			<section class="rounded-2xl border border-zinc-200 bg-white shadow-sm">
				<div class="border-b border-zinc-100 px-5 py-4">
					<h2 class="font-semibold">種目別結果</h2>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full min-w-150 text-sm">
						<thead>
							<tr class="border-b border-zinc-100">
								<th class="w-32 px-4 py-3 text-left text-xs font-medium text-zinc-400">種目</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-zinc-400"
									>{teamName(data.tie.teamAId)}</th
								>
								<th class="px-4 py-3 text-left text-xs font-medium text-zinc-400"
									>{teamName(data.tie.teamBId)}</th
								>
								<th class="w-24 px-4 py-3 text-left text-xs font-medium text-zinc-400">スコア</th>
								<th class="w-24 px-4 py-3 text-left text-xs font-medium text-zinc-400">状態</th>
								<th class="w-32 px-4 py-3 text-left text-xs font-medium text-zinc-400">操作</th>
							</tr>
						</thead>
						<tbody>
							{#each data.rubbers as rubber (rubber.id)}
								{@const playersA = lineupPlayers(rubber.code, 'A')}
								{@const playersB = lineupPlayers(rubber.code, 'B')}
								{@const liveRubber = data.liveRubbers.find((r) => r.id === rubber.id)}
								{@const rubberStatus = liveRubber?.status ?? rubber.status}
								<tr
									class="border-b border-zinc-100 last:border-0 {rubberStatus === 'playing'
										? 'bg-emerald-50'
										: ''}"
								>
									<td class="px-4 py-3 font-medium">{rubberLabel(rubber.code)}</td>
									<td class="px-4 py-3">
										{#if rubber.winnerSide === 'A'}
											<div class="space-y-0.5">
												<p class="text-sm font-semibold text-emerald-700">
													{teamName(data.tie.teamAId)}
												</p>
												{#each playersA as id (id)}
													<p class="text-xs text-zinc-600">{playerName(id)}</p>
												{/each}
											</div>
										{:else if playersA.length > 0}
											<div class="space-y-0.5">
												{#each playersA as id (id)}
													<p class="text-sm text-zinc-700">{playerName(id)}</p>
												{/each}
											</div>
										{:else}
											<span class="text-xs text-zinc-400">未割当</span>
										{/if}
									</td>
									<td class="px-4 py-3">
										{#if rubber.winnerSide === 'B'}
											<div class="space-y-0.5">
												<p class="text-sm font-semibold text-emerald-700">
													{teamName(data.tie.teamBId)}
												</p>
												{#each playersB as id (id)}
													<p class="text-xs text-zinc-600">{playerName(id)}</p>
												{/each}
											</div>
										{:else if playersB.length > 0}
											<div class="space-y-0.5">
												{#each playersB as id (id)}
													<p class="text-sm text-zinc-700">{playerName(id)}</p>
												{/each}
											</div>
										{:else}
											<span class="text-xs text-zinc-400">未割当</span>
										{/if}
									</td>
									<td class="px-4 py-3">
										{#if liveRubber?.gamesScore !== null && liveRubber?.gamesScore !== undefined}
											<p
												class="font-semibold tabular-nums {rubberStatus === 'playing'
													? 'text-emerald-700'
													: 'text-zinc-700'}"
											>
												{liveRubber.gamesScore}
											</p>
											{#each liveRubber.gameDetails as g (g.gameNo)}
												<p
													class="text-[11px] tabular-nums {rubberStatus === 'playing' &&
													g.gameNo === liveRubber.gameDetails.length
														? 'text-emerald-500'
														: 'text-zinc-400'}"
												>
													{g.scoreA}–{g.scoreB}
												</p>
											{/each}
										{:else}
											<span class="text-xs text-zinc-300">—</span>
										{/if}
									</td>
									<td class="px-4 py-3">
										<span class="text-xs {rubberStatusBgClass(rubberStatus)}">
											{rubberStatusLabel(rubberStatus)}
										</span>
									</td>
									<td class="px-4 py-3">
										{#if rubber.matchId}
											<div class="flex flex-wrap gap-2">
												<a
													class="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
													href={resolve('/referee/[matchId]', { matchId: rubber.matchId })}
												>
													スコア入力
												</a>
											</div>
										{:else}
											<span class="text-xs text-zinc-400">—</span>
										{/if}
									</td>
								</tr>
							{:else}
								<tr>
									<td colspan="5" class="px-4 py-6 text-center text-sm text-zinc-400">
										種目が作成されていません
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		{/if}
	</div>
</div>

{#snippet lineupPanel(
	side: 'A' | 'B',
	team: { id: string; name: string } | null,
	teamId: string | null
)}
	{@const lineup = lineupBySide(side)}
	{@const subStatus = lineup?.submission.status ?? null}
	<section class="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
		<!-- Panel header -->
		<div class="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
			<div class="flex items-center gap-3">
				<h2 class="text-base font-semibold">{team?.name ?? (side === 'A' ? 'A側' : 'B側')}</h2>
				<span
					class="rounded-full px-2.5 py-0.5 text-xs font-medium {submissionBadgeClass(subStatus)}"
				>
					{submissionStatusLabel(subStatus)}
				</span>
			</div>
			<div class="flex items-center gap-2">
				<!-- Link to team input page -->
				{#if teamId}
					<a
						href={resolve('/ties/[tieId]/lineups/[teamId]', { tieId: data.tie.id, teamId })}
						class="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
					>
						入力ページ
					</a>
				{/if}
				<!-- Approve / unapprove -->
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
						<button
							class="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100"
							onclick={() => run(() => lockLineup({ teamId: teamId! }))}
						>
							承認する
						</button>
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
	</section>
{/snippet}
