<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import Card from '$lib/components/Card.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import LongPressButton from '$lib/components/LongPressButton.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { matchStatusLabel } from '$lib/domain/tokyoLeagueLabels';
	import type { MatchPlayer } from '$lib/domain/types';
	import { cn } from '$lib/utils/cn';
	import { DragDropProvider, DragOverlay } from '@dnd-kit/svelte';
	import { isSortable } from '@dnd-kit/svelte/sortable';
	import { ArrowLeftRight, GripVertical } from '@lucide/svelte';
	import type { ComponentProps } from 'svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { PageProps } from './$types';
	import CourtSideSortableItem from './CourtSideSortableItem.svelte';
	import RefereeAdvancedControls from './RefereeAdvancedControls.svelte';
	import RefereeCourtDiagram from './RefereeCourtDiagram.svelte';
	import RefereeEventLog from './RefereeEventLog.svelte';
	import RefereeScoresheet from './RefereeScoresheet.svelte';
	import { confirm, rallyWon, resume, start, startGame, suspend, undo } from './referee.remote';

	type DragOverEvent = Parameters<
		NonNullable<ComponentProps<typeof DragDropProvider>['onDragOver']>
	>[0];
	type DragEndEvent = Parameters<
		NonNullable<ComponentProps<typeof DragDropProvider>['onDragEnd']>
	>[0];

	let { data }: PageProps = $props();

	let currentGame = $derived(
		data.state.games.find((game) => game.gameNo === data.state.currentGameNo)
	);
	let canEditService = $derived(
		data.state.status === 'playing' &&
			(currentGame?.score.A ?? 0) === 0 &&
			(currentGame?.score.B ?? 0) === 0
	);

	// Undo: find last undoable event that hasn't been undone yet
	const undoableEventTypes = [
		'rally_won',
		'correction_applied',
		'match_suspended',
		'match_resumed',
		'match_started',
		'game_started'
	];
	let undoneSeqNos = $derived(
		new Set(
			data.events
				.filter((e) => e.eventType === 'undo_applied' && e.targetSeqNo != null)
				.map((e) => e.targetSeqNo!)
		)
	);
	let lastUndoableEvent = $derived(
		[...data.events]
			.reverse()
			.find((e) => undoableEventTypes.includes(e.eventType) && !undoneSeqNos.has(e.seqNo)) ?? null
	);

	function undoLabel(e: (typeof data.events)[number]): string {
		if (e.eventType === 'rally_won') {
			const name = e.side === 'A' ? sideAName : e.side === 'B' ? sideBName : '?';
			return `${name} 得点 (${e.scoreAAfter}–${e.scoreBAfter})`;
		}
		if (e.eventType === 'match_started' || e.eventType === 'game_started') return 'サービス設定';
		if (e.eventType === 'match_suspended') return '中断';
		if (e.eventType === 'match_resumed') return '再開';
		if (e.eventType === 'correction_applied') return '訂正';
		return e.eventType;
	}

	let sideAPlayers = $derived(data.players.filter((player) => player.side === 'A'));
	let sideBPlayers = $derived(data.players.filter((player) => player.side === 'B'));
	let sideAName = $derived(data.match.sides.find((side) => side.side === 'A')?.displayName ?? 'A');
	let sideBName = $derived(data.match.sides.find((side) => side.side === 'B')?.displayName ?? 'B');

	function playerName(id: string | null | undefined): string {
		return data.players.find((player) => player.id === id)?.name ?? '-';
	}

	function playerOptions(players: MatchPlayer[]) {
		return players.map((player) => ({ value: player.id, label: player.name }));
	}

	let allPlayerItems = $derived([...playerOptions(sideAPlayers), ...playerOptions(sideBPlayers)]);
	let bFirstPlayerItems = $derived([
		...playerOptions(sideBPlayers),
		...playerOptions(sideAPlayers)
	]);

	// ── Change-of-ends tracking ────────────────────────────────────────────────
	// Persisted to localStorage by matchId. true = side A starts on the left.
	let courtSideKey = $derived(`referee_side_${data.state.matchId}`);
	let sideAStartsLeft = $state(true);
	let courtSideOrder = $state<('A' | 'B')[]>(['A', 'B']);
	let courtSideSnapshot: ('A' | 'B')[] = [];
	let courtSideGridWidth = $state(0);
	let courtSideCardWidth = $derived(Math.max(0, (courtSideGridWidth - 8) / 2));

	// Manual change-of-ends counter (persisted to localStorage)
	let manualChangeCount = $state(0);

	onMount(() => {
		const stored = localStorage.getItem(courtSideKey);
		if (stored === 'right') setSideAStartsLeft(false);
		else if (stored === 'left') setSideAStartsLeft(true);

		const storedCount = localStorage.getItem(`referee_changecount_${data.state.matchId}`);
		if (storedCount) manualChangeCount = parseInt(storedCount, 10) || 0;
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

	function doChangeEnds() {
		manualChangeCount += 1;
		localStorage.setItem(`referee_changecount_${data.state.matchId}`, String(manualChangeCount));
	}

	function sideDisplayName(side: 'A' | 'B') {
		return side === 'A' ? sideAName : sideBName;
	}

	function sideTeamName(side: 'A' | 'B') {
		return (side === 'A' ? sideAPlayers : sideBPlayers)[0]?.teamName;
	}

	function sideAccent(side: 'A' | 'B'): 'pink' | 'cyan' {
		return side === 'A' ? 'pink' : 'cyan';
	}

	function dndSide(id: unknown): 'A' | 'B' {
		return id === 'B' ? 'B' : 'A';
	}

	function courtSideLabel(side: 'A' | 'B'): '左' | '右' {
		return courtSideOrder.indexOf(side) === 0 ? '左' : '右';
	}

	// true = side A is currently on the physical left side of the court
	let sideAIsLeft = $derived(manualChangeCount % 2 === 0 ? sideAStartsLeft : !sideAStartsLeft);

	// Which side is currently left / right
	let leftSide = $derived(sideAIsLeft ? ('A' as const) : ('B' as const));
	let rightSide = $derived(sideAIsLeft ? ('B' as const) : ('A' as const));
	let leftSideName = $derived(sideAIsLeft ? sideAName : sideBName);
	let rightSideName = $derived(sideAIsLeft ? sideBName : sideAName);
	let leftSidePlayers = $derived(sideAIsLeft ? sideAPlayers : sideBPlayers);
	let rightSidePlayers = $derived(sideAIsLeft ? sideBPlayers : sideAPlayers);

	// Accent colors per physical side
	let leftAccent = $derived<'pink' | 'cyan'>(leftSide === 'A' ? 'pink' : 'cyan');
	let rightAccent = $derived<'pink' | 'cyan'>(leftSide === 'A' ? 'cyan' : 'pink');

	async function run(fn: () => Promise<unknown>) {
		try {
			await fn();
			await invalidateAll();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : '操作に失敗しました');
		}
	}
</script>

{#snippet scoreCard(
	side: 'A' | 'B',
	name: string,
	teamName: string | null | undefined,
	score: number,
	accent: 'pink' | 'cyan',
	serviceActive: boolean
)}
	<Card
		class="p-5 {serviceActive
			? accent === 'pink'
				? 'border-2 border-pink-500'
				: 'border-2 border-cyan-500'
			: ''}"
	>
		<p class="text-sm font-medium text-zinc-500">{name}</p>
		{#if teamName}
			<p class="text-xs text-zinc-400">{teamName}</p>
		{/if}
		<p class="mt-1 text-7xl leading-none font-bold tabular-nums">{score}</p>
		<div class="mt-4">
			<LongPressButton
				class={cn(
					'h-20 w-full rounded-2xl text-2xl font-bold text-white active:scale-95 disabled:bg-zinc-200 disabled:text-zinc-400',
					accent === 'pink' ? 'bg-pink-600 hover:bg-pink-700' : 'bg-cyan-600 hover:bg-cyan-700'
				)}
				disabled={data.state.status !== 'playing'}
				onclick={() => run(() => rallyWon({ side }))}
				onShortPress={() => toast.info('得点を記録するには長押ししてください')}
			>
				+1
			</LongPressButton>
		</div>
	</Card>
{/snippet}

<svelte:head>
	<title>スコア入力 | 東大リーグ団体戦</title>
</svelte:head>

<div class="grid gap-4">
	<!-- Header -->
	<Card class="p-5">
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
	</Card>

	<!-- Start game form -->
	{#if data.state.status === 'scheduled' || data.state.status === 'interval'}
		<Card class="p-5">
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
										sideAccent(side) === 'pink' ? 'border-pink-200' : 'border-cyan-200'
									)}
									style:width={courtSideCardWidth ? `${courtSideCardWidth}px` : undefined}
								>
									<div class="mb-2 flex items-center justify-between gap-2">
										<span
											class={cn(
												'rounded-full px-2 py-0.5 text-xs font-bold',
												sideAccent(side) === 'pink'
													? 'bg-pink-100 text-pink-700'
													: 'bg-cyan-100 text-cyan-700'
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
		</Card>
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

	<!-- Change-of-ends button -->
	<AppButton
		class="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-zinc-100 px-3 py-3 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-200 active:scale-95"
		type="button"
		onclick={doChangeEnds}
	>
		<ArrowLeftRight class="h-4 w-4" />
		チェンジエンド
	</AppButton>

	<!-- Service info -->
	<Card class="p-5">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-xs font-medium tracking-wide text-zinc-400">サービス情報</h2>
			{#if canEditService}
				<button
					type="button"
					class="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
					onclick={() => run(() => undo({}))}
				>
					サービス設定を修正
				</button>
			{/if}
		</div>
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
	</Card>

	<!-- Court diagram -->
	<RefereeCourtDiagram
		service={data.state.service}
		{sideAIsLeft}
		{leftAccent}
		{rightAccent}
		{leftSidePlayers}
		{rightSidePlayers}
		players={data.players}
	/>

	<!-- Controls -->
	<Card class="p-5">
		<h2 class="mb-3 text-xs font-medium tracking-wide text-zinc-400">操作</h2>
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
			<AppButton
				class="col-span-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 sm:col-span-1"
				type="button"
				disabled={!lastUndoableEvent}
				onclick={() => run(() => undo({}))}
			>
				<span class="block text-xs text-zinc-400">取り消し</span>
				<span class="block leading-tight wrap-break-word">
					{lastUndoableEvent ? undoLabel(lastUndoableEvent) : '—'}
				</span>
			</AppButton>
			<AppButton
				class="w-full rounded-xl bg-amber-100 px-3 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-200"
				type="button"
				onclick={() => run(() => suspend({ reason: 'referee_decision' }))}
			>
				中断
			</AppButton>
			<AppButton
				class="w-full rounded-xl bg-green-100 px-3 py-2.5 text-sm font-medium text-green-800 hover:bg-green-200"
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
	</Card>

	<!-- Scoresheet -->
	<RefereeScoresheet
		events={data.events}
		games={data.state.games}
		{sideAPlayers}
		{sideBPlayers}
		players={data.players}
	/>

	<!-- Advanced controls -->
	<RefereeAdvancedControls
		{currentGame}
		{sideAName}
		{sideBName}
		service={data.state.service}
		players={data.players}
		currentGameNo={data.state.currentGameNo}
		onRun={run}
	/>

	<!-- Event log -->
	<RefereeEventLog events={data.events} />
</div>
