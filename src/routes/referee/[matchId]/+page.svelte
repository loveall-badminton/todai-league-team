<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { DragDropProvider, DragOverlay } from '@dnd-kit/svelte';
	import { isSortable } from '@dnd-kit/svelte/sortable';
	import { GripVertical } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import type { ComponentProps } from 'svelte';
	import type { PageProps } from './$types';
	import type { MatchPlayer } from '$lib/domain/types';
	import AppButton from '$lib/components/AppButton.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import AppTextarea from '$lib/components/AppTextarea.svelte';
	import { matchStatusLabel } from '$lib/domain/tokyoLeagueLabels';
	import CourtSideSortableItem from './CourtSideSortableItem.svelte';
	import {
		rallyWon,
		start,
		startGame,
		undo,
		correction,
		letCalled,
		suspend,
		resume,
		forfeit,
		retire,
		confirm
	} from './referee.remote';
	import { cn } from '$lib/utils/cn';

	type DragOverEvent = Parameters<
		NonNullable<ComponentProps<typeof DragDropProvider>['onDragOver']>
	>[0];
	type DragEndEvent = Parameters<
		NonNullable<ComponentProps<typeof DragDropProvider>['onDragEnd']>
	>[0];

	let { data }: PageProps = $props();

	let cmdError = $state<string | null>(null);
	let correctionFormEl = $state<HTMLFormElement>();

	let currentGame = $derived(
		data.state.games.find((game) => game.gameNo === data.state.currentGameNo)
	);
	let sideAPlayers = $derived(data.players.filter((player) => player.side === 'A'));
	let sideBPlayers = $derived(data.players.filter((player) => player.side === 'B'));
	let sideAName = $derived(data.match.sides.find((side) => side.side === 'A')?.displayName ?? 'A');
	let sideBName = $derived(data.match.sides.find((side) => side.side === 'B')?.displayName ?? 'B');
	let reversedEvents = $derived([...data.events].reverse());
	let courtAssignmentsJson = $derived(
		data.state.service?.discipline === 'doubles'
			? JSON.stringify(data.state.service.courtAssignments)
			: ''
	);

	function playerName(id: string | null | undefined): string {
		return data.players.find((player) => player.id === id)?.name ?? '-';
	}

	function playerOptions(players: MatchPlayer[]) {
		return players.map((player) => ({ value: player.id, label: player.name }));
	}

	const eventTypeLabel: Record<string, string> = {
		match_started: '試合開始',
		game_started: 'ゲーム開始',
		rally_won: 'ラリー得点',
		undo: '取り消し',
		undo_applied: '取り消し',
		correction: 'スコア訂正',
		correction_applied: 'スコア訂正',
		let_called: 'レット',
		match_suspended: '試合中断',
		match_resumed: '試合再開',
		side_forfeited: '棄権',
		side_retired: 'リタイア',
		match_finished: '試合終了',
		match_confirmed: '結果確定'
	};

	function eventLabel(eventType: string): string {
		return eventTypeLabel[eventType] ?? eventType;
	}

	let letReason = $state('receiver_not_ready');
	let letNote = $state('');

	let allPlayerItems = $derived([...playerOptions(sideAPlayers), ...playerOptions(sideBPlayers)]);
	let bFirstPlayerItems = $derived([
		...playerOptions(sideBPlayers),
		...playerOptions(sideAPlayers)
	]);
	let servingSideItems = $derived([
		{ value: '', label: 'サービスサイド変更なし' },
		{ value: 'A', label: sideAName },
		{ value: 'B', label: sideBName }
	]);
	const serviceCourtItems = [
		{ value: '', label: 'サービスコート変更なし' },
		{ value: 'right', label: '右' },
		{ value: 'left', label: '左' }
	];
	let allPlayerCorrectionItems = $derived([
		{ value: '', label: 'サーバー変更なし' },
		...data.players.map((p) => ({ value: p.id, label: p.name }))
	]);
	let allReceiverCorrectionItems = $derived([
		{ value: '', label: 'レシーバー変更なし' },
		...data.players.map((p) => ({ value: p.id, label: p.name }))
	]);
	const letReasonItems = [
		{ value: 'receiver_not_ready', label: 'レシーバー未準備' },
		{ value: 'both_faulted', label: '双方フォルト' },
		{ value: 'shuttle_caught_on_net', label: 'ネットに引っかかった' },
		{ value: 'shuttle_disintegrated', label: 'シャトル破損' },
		{ value: 'line_judge_unsighted', label: '線審視認不能' },
		{ value: 'unforeseen_situation', label: '予期しない状況' },
		{ value: 'other', label: 'その他' }
	];

	// ── Change-of-ends tracking ────────────────────────────────────────────────
	// Persisted to localStorage by matchId. true = side A starts on the left.
	let courtSideKey = $derived(`referee_side_${data.state.matchId}`);
	let sideAStartsLeft = $state(true);
	let courtSideOrder = $state<('A' | 'B')[]>(['A', 'B']);
	let courtSideSnapshot: ('A' | 'B')[] = [];
	let courtSideGridWidth = $state(0);
	let courtSideCardWidth = $derived(Math.max(0, (courtSideGridWidth - 8) / 2));

	onMount(() => {
		const stored = localStorage.getItem(courtSideKey);
		if (stored === 'right') setSideAStartsLeft(false);
		else if (stored === 'left') setSideAStartsLeft(true);
	});

	function setSideAStartsLeft(val: boolean) {
		sideAStartsLeft = val;
		courtSideOrder = val ? ['A', 'B'] : ['B', 'A'];
		localStorage.setItem(courtSideKey, val ? 'left' : 'right');
	}

	function onCourtSideDragStart() {
		courtSideSnapshot = [...courtSideOrder];
	}

	function onCourtSideDragOver(event: DragOverEvent) {
		const { source, target } = event.operation;
		if (!isSortable(source) || !isSortable(target) || source.index === target.index) return;
		const next = [...courtSideOrder];
		const [moved] = next.splice(source.index, 1);
		next.splice(target.index, 0, moved);
		courtSideOrder = next;
	}

	function onCourtSideDragEnd(event: DragEndEvent) {
		if (event.canceled) {
			courtSideOrder = courtSideSnapshot;
			return;
		}
		setSideAStartsLeft(courtSideOrder[0] === 'A');
	}

	function sideDisplayName(side: 'A' | 'B') {
		return side === 'A' ? sideAName : sideBName;
	}

	function sideTeamName(side: 'A' | 'B') {
		return (side === 'A' ? sideAPlayers : sideBPlayers)[0]?.teamName;
	}

	function sideAccent(side: 'A' | 'B'): 'emerald' | 'sky' {
		return side === 'A' ? 'emerald' : 'sky';
	}

	function dndSide(id: unknown): 'A' | 'B' {
		return id === 'B' ? 'B' : 'A';
	}

	function courtSideLabel(side: 'A' | 'B'): '左' | '右' {
		return courtSideOrder.indexOf(side) === 0 ? '左' : '右';
	}

	// Number of change-of-ends completed so far:
	//   - 1 per completed game (between-game change)
	//   - +1 in game 3 once midgame interval is reached
	let changeCount = $derived.by(() => {
		const betweenGames = data.state.currentGameNo - 1;
		const game3 = data.state.games.find((g) => g.gameNo === 3);
		return betweenGames + (game3?.changeEndsRequired ? 1 : 0);
	});

	// true = side A is currently on the physical left side of the court
	let sideAIsLeft = $derived(changeCount % 2 === 0 ? sideAStartsLeft : !sideAStartsLeft);

	// Which side is currently left / right
	let leftSide = $derived(sideAIsLeft ? ('A' as const) : ('B' as const));
	let rightSide = $derived(sideAIsLeft ? ('B' as const) : ('A' as const));
	let leftSideName = $derived(sideAIsLeft ? sideAName : sideBName);
	let rightSideName = $derived(sideAIsLeft ? sideBName : sideAName);
	let leftSidePlayers = $derived(sideAIsLeft ? sideAPlayers : sideBPlayers);
	let rightSidePlayers = $derived(sideAIsLeft ? sideBPlayers : sideAPlayers);

	// Show change-of-ends notice at interval (between games)
	let changeEndsAtInterval = $derived(data.state.status === 'interval');
	// Show mid-game change-of-ends notice in 3rd game
	let changeEndsAtMidGame = $derived(
		data.state.status === 'playing' &&
			data.state.currentGameNo === data.state.scoring.maxGames &&
			(currentGame?.changeEndsRequired ?? false)
	);

	// Accent colors per physical side
	let leftAccent = $derived<'emerald' | 'sky'>(leftSide === 'A' ? 'emerald' : 'sky');
	let rightAccent = $derived<'emerald' | 'sky'>(leftSide === 'A' ? 'sky' : 'emerald');

	// Doubles court assignment per physical side (null for singles)
	let leftCA = $derived.by(() => {
		const svc = data.state.service;
		if (svc?.discipline !== 'doubles') return null;
		return sideAIsLeft ? svc.courtAssignments.A : svc.courtAssignments.B;
	});
	let rightCA = $derived.by(() => {
		const svc = data.state.service;
		if (svc?.discipline !== 'doubles') return null;
		return sideAIsLeft ? svc.courtAssignments.B : svc.courtAssignments.A;
	});

	async function run(fn: () => Promise<unknown>) {
		cmdError = null;
		try {
			await fn();
			await invalidateAll();
		} catch (e) {
			cmdError = e instanceof Error ? e.message : '操作に失敗しました';
		}
	}

	async function applyCorrectionFromForm() {
		if (!correctionFormEl) return;
		if (!correctionFormEl.reportValidity()) return;
		const fd = new FormData(correctionFormEl);
		await run(() =>
			correction({
				gameNo: data.state.currentGameNo,
				scoreA: Number(fd.get('scoreA')),
				scoreB: Number(fd.get('scoreB')),
				reason: String(fd.get('reason') ?? ''),
				servingSide: String(fd.get('servingSide') ?? '') || undefined,
				serviceCourt: String(fd.get('serviceCourt') ?? '') || undefined,
				serverPlayerId: String(fd.get('serverPlayerId') ?? '') || undefined,
				receiverPlayerId: String(fd.get('receiverPlayerId') ?? '') || undefined,
				courtAssignmentsJson: String(fd.get('courtAssignmentsJson') ?? '') || undefined
			})
		);
	}

	function attachCorrectionForm(node: HTMLFormElement) {
		correctionFormEl = node;
		return () => {
			if (correctionFormEl === node) correctionFormEl = undefined;
		};
	}

	/**
	 * Build BWF-style scoresheet data from events.
	 */
	interface ScoreEntry {
		scoreA: number;
		scoreB: number;
		isServiceOver: boolean;
	}

	interface ServiceRun {
		serverPlayerId: string;
		side: 'A' | 'B';
		scores: ScoreEntry[];
	}

	interface GameSheet {
		gameNo: number;
		serviceRuns: ServiceRun[];
		finalScoreA: number;
		finalScoreB: number;
		winnerSide: 'A' | 'B' | null;
	}

	let scoresheetByGame = $derived.by((): GameSheet[] => {
		const allEvents = [...data.events].sort((a, b) => a.seqNo - b.seqNo);

		const games: GameSheet[] = [];
		let currentGameNo = 1;
		let runs: ServiceRun[] = [];
		let currentRun: ServiceRun | null = null;
		let lastScoreA = 0;
		let lastScoreB = 0;

		for (const ev of allEvents) {
			if (ev.eventType === 'game_started' && ev.gameNo && ev.gameNo > currentGameNo) {
				if (currentRun) runs.push(currentRun);
				{
					const gs = data.state.games.find((g) => g.gameNo === currentGameNo);
					games.push({
						gameNo: currentGameNo,
						serviceRuns: runs,
						finalScoreA: gs?.score.A ?? lastScoreA,
						finalScoreB: gs?.score.B ?? lastScoreB,
						winnerSide: gs?.winnerSide ?? null
					});
				}
				currentGameNo = ev.gameNo;
				runs = [];
				currentRun = null;
				lastScoreA = 0;
				lastScoreB = 0;
			}

			if (ev.eventType === 'match_started') {
				const serverId = ev.serverPlayerIdAfter;
				const receiverId = ev.receiverPlayerIdAfter;
				const serverSide = data.players.find((p) => p.id === serverId)?.side ?? ('A' as 'A' | 'B');
				const receiverSide =
					data.players.find((p) => p.id === receiverId)?.side ?? ('B' as 'A' | 'B');

				currentRun = {
					serverPlayerId: serverId ?? '',
					side: serverSide,
					scores: [{ scoreA: 0, scoreB: 0, isServiceOver: false }]
				};

				runs.push({
					serverPlayerId: receiverId ?? '',
					side: receiverSide,
					scores: [{ scoreA: 0, scoreB: 0, isServiceOver: true }]
				});
			}

			if (ev.eventType === 'game_started' && ev.gameNo && ev.gameNo === currentGameNo) {
				const serverId = ev.serverPlayerIdAfter;
				const receiverId = ev.receiverPlayerIdAfter;
				const serverSide = data.players.find((p) => p.id === serverId)?.side ?? ('A' as 'A' | 'B');
				const receiverSide =
					data.players.find((p) => p.id === receiverId)?.side ?? ('B' as 'A' | 'B');

				runs.push({
					serverPlayerId: receiverId ?? '',
					side: receiverSide,
					scores: [{ scoreA: 0, scoreB: 0, isServiceOver: true }]
				});

				currentRun = {
					serverPlayerId: serverId ?? '',
					side: serverSide,
					scores: [{ scoreA: 0, scoreB: 0, isServiceOver: false }]
				};
			}

			if (ev.eventType === 'rally_won' && ev.scoreAAfter !== null && ev.scoreBAfter !== null) {
				const scoreA = ev.scoreAAfter;
				const scoreB = ev.scoreBAfter;
				const serverBefore = ev.serverPlayerIdBefore;
				const serverAfter = ev.serverPlayerIdAfter;

				const serviceChanged = serverBefore !== serverAfter;

				if (serviceChanged && currentRun) {
					if (currentRun.scores.length > 0) {
						currentRun.scores[currentRun.scores.length - 1].isServiceOver = true;
					}
					runs.push(currentRun);

					const newServerSide =
						data.players.find((p) => p.id === serverAfter)?.side ?? ('A' as 'A' | 'B');
					currentRun = {
						serverPlayerId: serverAfter ?? '',
						side: newServerSide,
						scores: [{ scoreA, scoreB, isServiceOver: false }]
					};
				} else if (currentRun) {
					currentRun.scores.push({ scoreA, scoreB, isServiceOver: false });
				} else {
					const sid = serverAfter ?? '';
					const ss = data.players.find((p) => p.id === sid)?.side ?? ('A' as 'A' | 'B');
					currentRun = {
						serverPlayerId: sid,
						side: ss,
						scores: [{ scoreA, scoreB, isServiceOver: false }]
					};
				}

				lastScoreA = scoreA;
				lastScoreB = scoreB;
			}
		}

		if (currentRun) runs.push(currentRun);
		if (runs.length > 0) {
			{
				const gs = data.state.games.find((g) => g.gameNo === currentGameNo);
				games.push({
					gameNo: currentGameNo,
					serviceRuns: runs,
					finalScoreA: gs?.score.A ?? lastScoreA,
					finalScoreB: gs?.score.B ?? lastScoreB,
					winnerSide: gs?.winnerSide ?? null
				});
			}
		}

		return games;
	});
</script>

{#snippet scoreCard(
	side: 'A' | 'B',
	name: string,
	teamName: string | null | undefined,
	score: number,
	accent: 'emerald' | 'sky',
	serviceActive: boolean
)}
	<div
		class="rounded-2xl border bg-white p-5 shadow-sm {serviceActive
			? accent === 'emerald'
				? 'border-2 border-emerald-500'
				: 'border-2 border-sky-500'
			: 'border-zinc-200'}"
	>
		<p class="text-sm font-medium text-zinc-500">{name}</p>
		{#if teamName}
			<p class="text-xs text-zinc-400">{teamName}</p>
		{/if}
		<p class="mt-1 text-7xl leading-none font-bold tabular-nums">{score}</p>
		<div class="mt-4">
			<AppButton
				class={cn(
					'h-20 w-full rounded-2xl text-2xl font-bold text-white active:scale-95 disabled:bg-zinc-200 disabled:text-zinc-400',
					accent === 'emerald'
						? 'bg-emerald-600 hover:bg-emerald-700'
						: 'bg-sky-600 hover:bg-sky-700'
				)}
				disabled={data.state.status !== 'playing'}
				type="button"
				onclick={() => run(() => rallyWon({ side }))}
			>
				+1
			</AppButton>
		</div>
	</div>
{/snippet}

{#snippet playerCell(playerId: string, accent: 'emerald' | 'sky', hasBorderBottom: boolean)}
	{@const isServer = data.state.service?.serverPlayerId === playerId}
	{@const isReceiver = data.state.service?.receiverPlayerId === playerId}
	{@const player = data.players.find((p) => p.id === playerId)}
	<div
		class="flex min-h-18 flex-col items-center justify-center gap-0.5 p-3 text-center
		{hasBorderBottom ? 'border-b border-zinc-100' : ''}
		{isServer
			? accent === 'emerald'
				? 'bg-emerald-50'
				: 'bg-sky-50'
			: isReceiver
				? 'bg-zinc-50'
				: ''}"
	>
		{#if isServer}
			<span
				class={cn('text-xs font-bold', accent === 'emerald' ? 'text-emerald-500' : 'text-sky-500')}
				>サーバー</span
			>
		{:else if isReceiver}
			<span
				class={cn(
					'text-xs text-zinc-400',
					accent === 'emerald' ? 'text-emerald-500' : 'text-sky-500'
				)}>レシーバー</span
			>
		{:else}
			<span class="text-xs text-zinc-300">—</span>
		{/if}
		<p class="text-sm leading-tight font-medium text-zinc-800">{playerName(playerId)}</p>
		{#if player?.teamName}
			<p class="text-[10px] text-zinc-400">{player.teamName}</p>
		{/if}
	</div>
{/snippet}

<svelte:head>
	<title>スコア入力 | 東大リーグ団体戦</title>
</svelte:head>

<div class="grid gap-4">
	<!-- Header -->
	<header class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
		<a
			class="text-sm text-zinc-500 hover:text-zinc-700"
			href={resolve('/tournaments/[tournamentId]', { tournamentId: data.match.tournamentId })}
		>
			← 大会詳細
		</a>
		<PageHeader
			title={`${leftSideName} vs ${rightSideName}`}
			description={`${data.match.court?.name ?? 'コート未設定'} · ゲーム ${data.state.currentGameNo} · ${matchStatusLabel(
				data.state.status
			)}`}
		/>
		<div class="mt-2 flex items-center justify-between gap-3">
			<div class="text-right">
				<p class="text-xs text-zinc-400">ゲーム数</p>
				<p class="text-2xl font-bold tabular-nums">
					{data.state.gamesWon[leftSide]} – {data.state.gamesWon[rightSide]}
				</p>
			</div>
		</div>
		{#if cmdError}
			<p class="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{cmdError}</p>
		{/if}
	</header>

	<!-- Change-of-ends banner -->
	{#if changeEndsAtInterval}
		<div class="rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4">
			<p class="text-sm font-bold text-amber-800">チェンジエンド</p>
			<p class="mt-0.5 text-sm text-amber-700">選手はコートを入れ替えてください。</p>
			<p class="mt-1.5 text-xs text-amber-600">
				次ゲーム：
				<span class="font-semibold">{sideAName}</span> → {sideAIsLeft ? '左コート' : '右コート'} ／
				<span class="font-semibold">{sideBName}</span> → {sideAIsLeft ? '右コート' : '左コート'}
			</p>
		</div>
	{/if}
	{#if changeEndsAtMidGame}
		<div class="rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4">
			<p class="text-sm font-bold text-amber-800">チェンジエンド（第3ゲーム インターバル）</p>
			<p class="mt-0.5 text-sm text-amber-700">選手はコートを入れ替えてください。</p>
			<p class="mt-1.5 text-xs text-amber-600">
				現在：
				<span class="font-semibold">{sideAName}</span> → {sideAIsLeft ? '左コート' : '右コート'} ／
				<span class="font-semibold">{sideBName}</span> → {sideAIsLeft ? '右コート' : '左コート'}
			</p>
		</div>
	{/if}

	<!-- Start game form -->
	{#if data.state.status === 'scheduled' || data.state.status === 'interval'}
		<section class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
			<h2 class="mb-3 font-semibold">
				{data.state.status === 'scheduled' ? '試合開始' : '次ゲーム開始'}
			</h2>

			{#if data.state.status === 'scheduled'}
				<!-- Court side order (only at match start) -->
				<div class="mb-4">
					<div class="mb-2 text-xs font-medium text-zinc-400">
						ドラッグアンドドロップで選手の位置を入れ替えてください。
					</div>
					<DragDropProvider
						onDragStart={onCourtSideDragStart}
						onDragOver={onCourtSideDragOver}
						onDragEnd={onCourtSideDragEnd}
					>
						<div bind:clientWidth={courtSideGridWidth} class="grid grid-cols-2 gap-2">
							{#each courtSideOrder as side, index (side)}
								<CourtSideSortableItem
									{side}
									{index}
									name={sideDisplayName(side)}
									teamName={sideTeamName(side)}
									sideLabel={courtSideLabel(side)}
									accent={sideAccent(side)}
								/>
							{/each}
						</div>
						<DragOverlay dropAnimation={null}>
							{#snippet children(source)}
								{@const side = dndSide(source.id)}
								<div
									class={cn(
										'min-h-24 rounded-xl border bg-white/95 p-3 shadow-xl backdrop-blur-sm',
										sideAccent(side) === 'emerald' ? 'border-emerald-200' : 'border-sky-200'
									)}
									style:width={courtSideCardWidth ? `${courtSideCardWidth}px` : undefined}
								>
									<div class="mb-2 flex items-center justify-between gap-2">
										<span
											class={cn(
												'rounded-full px-2 py-0.5 text-xs font-bold',
												sideAccent(side) === 'emerald'
													? 'bg-emerald-100 text-emerald-700'
													: 'bg-sky-100 text-sky-700'
											)}>{courtSideLabel(side)}</span
										>
										<div class="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-300">
											<GripVertical class="h-4 w-4" />
										</div>
									</div>
									<p class="truncate text-sm font-semibold text-zinc-950">
										{sideDisplayName(side)}
									</p>
									{#if sideTeamName(side)}
										<p class="mt-0.5 truncate text-xs text-zinc-400">{sideTeamName(side)}</p>
									{/if}
								</div>
							{/snippet}
						</DragOverlay>
					</DragDropProvider>
				</div>
			{/if}

			<form
				onsubmit={async (e) => {
					e.preventDefault();
					const fd = new FormData(e.currentTarget as HTMLFormElement);
					await run(async () => {
						const initialServerPlayerId = String(fd.get('initialServerPlayerId') ?? '');
						const initialReceiverPlayerId = String(fd.get('initialReceiverPlayerId') ?? '');
						if (data.state.status === 'scheduled') {
							await start({ initialServerPlayerId, initialReceiverPlayerId });
						} else {
							await startGame({
								gameNo: data.state.currentGameNo,
								initialServerPlayerId,
								initialReceiverPlayerId
							});
						}
					});
				}}
				class="grid gap-3 sm:grid-cols-2"
			>
				<div class="grid gap-1">
					<span class="text-xs font-medium text-zinc-500">1st サーバー</span>
					<AppSelect
						name="initialServerPlayerId"
						value={data.state.service?.serverPlayerId ?? ''}
						items={allPlayerItems}
						required
					/>
				</div>
				<div class="grid gap-1">
					<span class="text-xs font-medium text-zinc-500">1st レシーバー</span>
					<AppSelect
						name="initialReceiverPlayerId"
						value={data.state.service?.receiverPlayerId ?? ''}
						items={bFirstPlayerItems}
						required
					/>
				</div>
				<div class="sm:col-span-2">
					<AppButton
						class="rounded-xl bg-zinc-950 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
						type="submit"
					>
						開始
					</AppButton>
				</div>
			</form>
		</section>
	{/if}

	<!-- Score + tap buttons (ordered by physical court: left first, right second) -->
	<div class="grid grid-cols-2 gap-3">
		{@render scoreCard(
			leftSide,
			leftSideName,
			leftSidePlayers[0]?.teamName,
			currentGame?.score[leftSide] ?? 0,
			leftAccent,
			data.state.service?.servingSide === leftSide
		)}
		{@render scoreCard(
			rightSide,
			rightSideName,
			rightSidePlayers[0]?.teamName,
			currentGame?.score[rightSide] ?? 0,
			rightAccent,
			data.state.service?.servingSide === rightSide
		)}
	</div>

	<!-- Service info -->
	<section class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
		<h2 class="mb-3 text-xs font-medium tracking-wide text-zinc-400">サービス情報</h2>
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
			<div>
				<p class="text-xs text-zinc-500">サーバー</p>
				<p class="mt-0.5 font-medium">{playerName(data.state.service?.serverPlayerId)}</p>
			</div>
			<div>
				<p class="text-xs text-zinc-500">レシーバー</p>
				<p class="mt-0.5 font-medium">{playerName(data.state.service?.receiverPlayerId)}</p>
			</div>
			<div class="col-span-2 sm:col-span-1">
				<p class="text-xs text-zinc-500">サービスコート</p>
				<p class="mt-0.5 font-medium">
					{data.state.service?.servingSide === 'A'
						? sideAName
						: data.state.service?.servingSide === 'B'
							? sideBName
							: '-'}が{data.state.service?.serviceCourt == 'right'
						? '右'
						: data.state.service?.serviceCourt == 'left'
							? '左'
							: '-'}からサーブ
				</p>
			</div>
		</div>
	</section>

	<!-- Scoresheet view -->
	<section class="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
		<div class="border-b border-zinc-100 px-5 py-3">
			<h2 class="text-sm font-medium text-zinc-700">スコアシート</h2>
		</div>
		{#each scoresheetByGame as game, gi (gi)}
			{@const aPlayers = sideAPlayers}
			{@const bPlayers = sideBPlayers}
			<div class="px-3 py-4 {gi > 0 ? 'border-t border-zinc-200' : ''}">
				<div class="mb-3 flex items-center justify-between">
					<p class="text-xs font-medium tracking-wide text-zinc-400">
						第{game.gameNo}ゲーム
					</p>
					{#if game.winnerSide}
						<span
							class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold
									{game.winnerSide === 'A' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}"
						>
							{game.finalScoreA}–{game.finalScoreB}
						</span>
					{/if}
				</div>

				<!-- BWF Score Sheet Table -->
				<div class="overflow-x-auto">
					<table class="w-full border-collapse text-xs">
						<tbody>
							<!-- Side A rows -->
							{#each aPlayers as player (player.id)}
								{@const playerRuns = game.serviceRuns.filter((r) => r.serverPlayerId === player.id)}
								<tr
									class={cn(
										'w-fit border-b border-zinc-100',
										playerRuns.length > 0 ? '' : 'opacity-50'
									)}
								>
									<td
										class="sticky left-0 z-10 border-r border-zinc-200 bg-emerald-50 px-2 py-1.5 font-medium whitespace-nowrap text-emerald-800"
										style="min-width: 5rem; max-width: 7rem;"
									>
										<div class="flex items-center gap-1 truncate">
											<span class="truncate">{player.name}</span>
										</div>
									</td>

									<td class="p-0">
										<div class="flex items-stretch">
											{#each game.serviceRuns as run, ri (ri)}
												{#if run.serverPlayerId === player.id}
													{#each run.scores as entry (entry.scoreA + '-' + entry.scoreB + '-' + entry.isServiceOver)}
														<div
															class="flex min-w-7 items-center justify-center border-r border-zinc-100 px-1 py-1.5 font-medium text-emerald-700 tabular-nums"
														>
															{entry.scoreA}
														</div>
													{/each}
													{#if ri < game.serviceRuns.length - 1}
														<div class="flex items-center border-r-2 border-zinc-300"></div>
													{/if}
												{:else}
													{#each run.scores as _entry (_entry.scoreA + '-' + _entry.scoreB)}
														<div class="min-w-7 border-r border-zinc-100 px-1 py-1.5"></div>
													{/each}
													{#if ri < game.serviceRuns.length - 1}
														<div class="flex items-center border-r-2 border-zinc-300"></div>
													{/if}
												{/if}
											{/each}
											{#if playerRuns.length === 0 && game.serviceRuns.length === 0}
												<div class="px-2 py-1.5 text-zinc-300">—</div>
											{/if}
										</div>
									</td>
								</tr>
							{/each}
						</tbody>

						<tbody>
							<tr>
								<td
									class="sticky left-0 z-10 border-y-2 border-zinc-400 bg-zinc-100 px-2 py-0.5 text-center text-[10px] font-medium tracking-wider text-zinc-400"
								>
									—
								</td>
								<td class="border-y-2 border-zinc-400 bg-zinc-100 p-0">
									<div class="flex items-stretch">
										{#each game.serviceRuns as run, ri (ri)}
											{#each run.scores as _entry (_entry.scoreA + '-' + _entry.scoreB)}
												<div class="min-w-7 border-r border-zinc-300 px-1 py-0.5"></div>
											{/each}
											{#if ri < game.serviceRuns.length - 1}
												<div class="border-r-2 border-zinc-300"></div>
											{/if}
										{/each}
									</div>
								</td>
							</tr>
						</tbody>

						<tbody>
							{#each bPlayers as player (player.id)}
								{@const playerRuns = game.serviceRuns.filter((r) => r.serverPlayerId === player.id)}
								<tr
									class={cn(
										'w-fit border-b border-zinc-100',
										playerRuns.length > 0 ? '' : 'opacity-50'
									)}
								>
									<td
										class="sticky left-0 z-10 border-r border-zinc-200 bg-sky-50 px-2 py-1.5 font-medium whitespace-nowrap text-sky-800"
										style="min-width: 5rem; max-width: 7rem;"
									>
										<div class="flex items-center gap-1 truncate">
											<span class="truncate">{player.name}</span>
										</div>
									</td>

									<td class="p-0">
										<div class="flex items-stretch">
											{#each game.serviceRuns as run, ri (ri)}
												{#if run.serverPlayerId === player.id}
													{#each run.scores as entry (entry.scoreA + '-' + entry.scoreB + '-' + entry.isServiceOver)}
														<div
															class="flex min-w-7 items-center justify-center border-r border-zinc-100 px-1 py-1.5 font-medium text-sky-700 tabular-nums"
														>
															{entry.scoreB}
														</div>
													{/each}
													{#if ri < game.serviceRuns.length - 1}
														<div class="flex items-center border-r-2 border-zinc-300"></div>
													{/if}
												{:else}
													{#each run.scores as _entry (_entry.scoreA + '-' + _entry.scoreB)}
														<div class="min-w-7 border-r border-zinc-100 px-1 py-1.5"></div>
													{/each}
													{#if ri < game.serviceRuns.length - 1}
														<div class="flex items-center border-r-2 border-zinc-300"></div>
													{/if}
												{/if}
											{/each}
											{#if playerRuns.length === 0 && game.serviceRuns.length === 0}
												<div class="px-2 py-1.5 text-zinc-300">—</div>
											{/if}
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="mt-2 flex items-center gap-4 text-[10px] text-zinc-400">
					<span>太線 ＝ サービスオーバー</span>
					<span>数字 ＝ サーバー側得点</span>
				</div>
			</div>
		{:else}
			<div class="px-5 py-8 text-center text-sm text-zinc-400">得点データがありません</div>
		{/each}
	</section>

	<!-- Court diagram (landscape: net is a vertical line) -->
	{#if data.state.service}
		<section class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
			<h2 class="mb-3 text-xs font-medium tracking-wide text-zinc-400">コート配置</h2>

			<!-- Team labels -->
			<div class="mb-1 grid grid-cols-[1fr_2rem_1fr]">
				<p
					class="text-center text-xs font-semibold {leftAccent === 'emerald'
						? 'text-emerald-600'
						: 'text-sky-600'}"
				>
					左
				</p>
				<div></div>
				<p
					class="text-center text-xs font-semibold {rightAccent === 'emerald'
						? 'text-emerald-600'
						: 'text-sky-600'}"
				>
					右
				</p>
			</div>

			{#if leftCA && rightCA}
				<!-- Doubles: 2×2 grid with NET spanning both rows -->
				<div
					class="grid grid-cols-[1fr_2rem_1fr] overflow-hidden rounded-xl border-2 border-zinc-300"
				>
					<!-- Upper-left: leftCA.left -->
					<div class="col-start-1 row-start-1">
						{@render playerCell(leftCA.left, leftAccent, true)}
					</div>
					<!-- NET column (spans rows 1-2) -->
					<div
						class="col-start-2 row-span-2 row-start-1 flex items-center justify-center border-x-2 border-zinc-400 bg-zinc-100"
					>
						<span
							class="text-[10px] font-medium tracking-widest text-zinc-400"
							style="writing-mode: vertical-rl">ネット</span
						>
					</div>
					<!-- Upper-right: rightCA.right -->
					<div class="col-start-3 row-start-1">
						{@render playerCell(rightCA.right, rightAccent, true)}
					</div>
					<!-- Lower-left: leftCA.right -->
					<div class="col-start-1 row-start-2">
						{@render playerCell(leftCA.right, leftAccent, false)}
					</div>
					<!-- Lower-right: rightCA.left -->
					<div class="col-start-3 row-start-2">
						{@render playerCell(rightCA.left, rightAccent, false)}
					</div>
				</div>
			{:else}
				<!-- Singles: one player on each side -->
				{@const leftPlayer = leftSidePlayers[0]}
				{@const rightPlayer = rightSidePlayers[0]}
				<div
					class="grid grid-cols-[1fr_2rem_1fr] overflow-hidden rounded-xl border-2 border-zinc-300"
				>
					{#if leftPlayer}
						<div>{@render playerCell(leftPlayer.id, leftAccent, false)}</div>
					{/if}
					<div class="flex items-center justify-center border-x-2 border-zinc-400 bg-zinc-100">
						<span
							class="text-[10px] font-medium tracking-widest text-zinc-400"
							style="writing-mode: vertical-rl">NET</span
						>
					</div>
					{#if rightPlayer}
						<div>{@render playerCell(rightPlayer.id, rightAccent, false)}</div>
					{/if}
				</div>
			{/if}
		</section>
	{/if}

	<!-- Controls -->
	<section class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
		<h2 class="mb-3 text-xs font-medium tracking-wide text-zinc-400">操作</h2>
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
			<AppButton
				class="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
				type="button"
				onclick={() => run(() => undo({}))}
			>
				取り消し
			</AppButton>
			<AppButton
				class="w-full rounded-xl bg-amber-100 px-3 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-200"
				type="button"
				onclick={() => run(() => suspend({ reason: 'referee_decision' }))}
			>
				中断
			</AppButton>
			<AppButton
				class="w-full rounded-xl bg-emerald-100 px-3 py-2.5 text-sm font-medium text-emerald-800 hover:bg-emerald-200"
				type="button"
				onclick={() => run(() => resume({}))}
			>
				再開
			</AppButton>
			<ConfirmDialog
				onConfirm={() => run(() => confirm())}
				triggerLabel="結果確定"
				triggerClass="w-full rounded-xl bg-zinc-950 px-3 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
				title="結果を確定しますか？"
				description="確定後は通常の審判操作では変更できません。スコアと勝者を確認してください。"
				confirmLabel="結果を確定する"
			/>
		</div>
	</section>

	<!-- Advanced: correction / let / forfeit / retire -->
	<section class="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
		<h2 class="border-b border-zinc-100 px-5 py-3 text-xs font-medium tracking-wide text-zinc-400">
			高度な操作
		</h2>
		<div class="divide-y divide-zinc-100">
			<!-- Correction -->
			<details class="group">
				<summary
					class="cursor-pointer list-none px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 [&::-webkit-details-marker]:hidden"
				>
					スコア訂正
				</summary>
				<form
					{@attach attachCorrectionForm}
					onsubmit={(e) => {
						e.preventDefault();
					}}
					class="grid gap-3 px-5 pb-4"
				>
					<div class="grid grid-cols-2 gap-2">
						<AppInput
							name="scoreA"
							type="number"
							placeholder="{sideAName} スコア"
							value={currentGame?.score.A ?? 0}
						/>
						<AppInput
							name="scoreB"
							type="number"
							placeholder="{sideBName} スコア"
							value={currentGame?.score.B ?? 0}
						/>
					</div>
					<AppInput name="reason" placeholder="訂正理由" required />
					<details class="rounded-xl border border-zinc-100">
						<summary class="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-500">
							サービス状態も訂正
						</summary>
						<div class="grid gap-2 px-3 pt-1 pb-3">
							<AppSelect
								name="servingSide"
								value={data.state.service?.servingSide ?? ''}
								items={servingSideItems}
							/>
							<AppSelect
								name="serviceCourt"
								value={data.state.service?.serviceCourt ?? ''}
								items={serviceCourtItems}
							/>
							<AppSelect
								name="serverPlayerId"
								value={data.state.service?.serverPlayerId ?? ''}
								items={allPlayerCorrectionItems}
							/>
							<AppSelect
								name="receiverPlayerId"
								value={data.state.service?.receiverPlayerId ?? ''}
								items={allReceiverCorrectionItems}
							/>
							{#if data.state.service?.discipline === 'doubles'}
								<AppTextarea name="courtAssignmentsJson" class="min-h-20 font-mono text-xs"
									>{courtAssignmentsJson}</AppTextarea
								>
							{/if}
						</div>
					</details>
					<ConfirmDialog
						onConfirm={applyCorrectionFromForm}
						triggerLabel="訂正する"
						triggerClass="w-full rounded-xl bg-zinc-950 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-zinc-800"
						title="スコアを訂正しますか？"
						description="現在のゲームスコアと必要に応じてサービス状態を上書きします。入力内容を確認してください。"
						confirmLabel="訂正を確定する"
					/>
				</form>
			</details>

			<!-- Let -->
			<details>
				<summary
					class="cursor-pointer list-none px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 [&::-webkit-details-marker]:hidden"
				>
					レット
				</summary>
				<div class="grid gap-3 px-5 pb-4">
					<AppSelect name="letReason" bind:value={letReason} items={letReasonItems} />
					<AppInput name="letNote" bind:value={letNote} placeholder="メモ" />
					<ConfirmDialog
						onConfirm={() =>
							run(() => letCalled({ reason: letReason, note: letNote || undefined }))}
						triggerLabel="記録する"
						triggerClass="w-full rounded-xl bg-zinc-950 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-zinc-800"
						title="レットを記録しますか？"
						description="スコアは変えずにレットのイベントだけを記録します。"
						confirmLabel="レットを記録する"
					/>
				</div>
			</details>

			<!-- Forfeit -->
			<details>
				<summary
					class="cursor-pointer list-none px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 [&::-webkit-details-marker]:hidden"
				>
					棄権
				</summary>
				<div class="grid grid-cols-2 gap-2 px-5 pb-4">
					<ConfirmDialog
						onConfirm={() => run(() => forfeit({ side: 'A' }))}
						triggerLabel={`${sideAName} 棄権`}
						triggerClass="rounded-xl bg-red-600 px-3 py-3 text-sm font-bold text-white shadow-sm hover:bg-red-700"
						title={`${sideAName}を棄権にしますか？`}
						description={`${sideBName}を勝者として試合を棄権終了にします。`}
						confirmLabel="棄権を確定する"
						confirmClass="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 transition-colors"
					/>
					<ConfirmDialog
						onConfirm={() => run(() => forfeit({ side: 'B' }))}
						triggerLabel={`${sideBName} 棄権`}
						triggerClass="rounded-xl bg-red-600 px-3 py-3 text-sm font-bold text-white shadow-sm hover:bg-red-700"
						title={`${sideBName}を棄権にしますか？`}
						description={`${sideAName}を勝者として試合を棄権終了にします。`}
						confirmLabel="棄権を確定する"
						confirmClass="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 transition-colors"
					/>
				</div>
			</details>

			<!-- Retire -->
			<details>
				<summary
					class="cursor-pointer list-none px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 [&::-webkit-details-marker]:hidden"
				>
					リタイア
				</summary>
				<div class="grid grid-cols-2 gap-2 px-5 pb-4">
					<ConfirmDialog
						onConfirm={() => run(() => retire({ side: 'A' }))}
						triggerLabel={`${sideAName} リタイア`}
						triggerClass="rounded-xl bg-red-600 px-3 py-3 text-sm font-bold text-white shadow-sm hover:bg-red-700"
						title={`${sideAName}をリタイアにしますか？`}
						description={`${sideBName}を勝者として試合をリタイア終了にします。`}
						confirmLabel="リタイアを確定する"
						confirmClass="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 transition-colors"
					/>
					<ConfirmDialog
						onConfirm={() => run(() => retire({ side: 'B' }))}
						triggerLabel={`${sideBName} リタイア`}
						triggerClass="rounded-xl bg-red-600 px-3 py-3 text-sm font-bold text-white shadow-sm hover:bg-red-700"
						title={`${sideBName}をリタイアにしますか？`}
						description={`${sideAName}を勝者として試合をリタイア終了にします。`}
						confirmLabel="リタイアを確定する"
						confirmClass="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 transition-colors"
					/>
				</div>
			</details>
		</div>
	</section>

	<!-- Event log -->
	<section class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
		<h2 class="mb-3 text-xs font-medium tracking-wide text-zinc-400">イベントログ</h2>
		<div class="max-h-72 space-y-1.5 overflow-auto">
			{#each reversedEvents as event (event.id)}
				<div
					class="grid grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2 text-sm"
				>
					<span class="text-zinc-400 tabular-nums">#{event.seqNo}</span>
					<span class="text-zinc-700">{eventLabel(event.eventType)}</span>
					<span class="font-medium text-zinc-500 tabular-nums">
						{event.scoreAAfter ?? '-'}–{event.scoreBAfter ?? '-'}
					</span>
				</div>
			{/each}
		</div>
	</section>
</div>
