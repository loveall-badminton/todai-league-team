<script lang="ts">
	import { isConfirmableMatchStatus } from '$lib/domain/matchStatus';
	import AppButton from '$lib/components/AppButton.svelte';
	import Card from '$lib/components/Card.svelte';
	import CourtSideToggle from '$lib/components/CourtSideToggle.svelte';
	import LongPressButton from '$lib/components/LongPressButton.svelte';
	import RealtimeSync from '$lib/components/RealtimeSync.svelte';
	import { hasScoreUpdate, matchChannel, type LiveTopicPayloadMap } from '$lib/realtime/channels';
	import type { RealtimeUpdate } from '$lib/realtime/updates';
	import {
		applyRefereeScorePayload,
		type RefereeEventView,
		type RefereeLiveView
	} from './refereeRealtime';
	import { cn } from '$lib/utils/cn';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { PageProps } from './$types';
	import RefereeAdvancedControls from './RefereeAdvancedControls.svelte';
	import RefereeCourtDiagram from './RefereeCourtDiagram.svelte';
	import RefereeEventLog from './RefereeEventLog.svelte';
	import RefereeMatchFinishedCard from './RefereeMatchFinishedCard.svelte';
	import RefereeScoresheet from './RefereeScoresheet.svelte';
	import { rallyWonCommand, start, startGame, undoCommand } from './referee.remote';
	import { loadJsonFromLocalStorage, saveJsonToLocalStorage } from '$lib/utils/localStorage';
	import {
		undoLabel as buildUndoLabel,
		findLastUndoableEvent,
		playerOptions
	} from './refereeUtils';
	import * as v from 'valibot';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import { Undo2 } from '@lucide/svelte';

	let { data, form: formResult }: PageProps = $props();

	// 毎得点の invalidateAll(load 全再実行)を避けるため、スコアと
	// イベントログは WS / フォーム結果の payload をローカル差分適用して表示する。
	// load 再実行(invalidateAll)後は seqNo の新しい方を採用する。
	let overlay = $state.raw<RefereeLiveView | null>(null);
	let liveView = $derived(
		overlay && overlay.state.lastSeqNo > data.state.lastSeqNo
			? overlay
			: { state: data.state, events: data.events as RefereeEventView[] }
	);
	let matchState = $derived(liveView.state);
	let matchEvents = $derived(liveView.events);

	function applyScorePayload(
		payload: LiveTopicPayloadMap['score']
	): 'applied' | 'refresh' | 'ignore' {
		const next = applyRefereeScorePayload(payload, liveView);
		if (next === 'refresh') return 'refresh';
		if (next === null) return 'ignore';
		overlay = next;
		return 'applied';
	}

	function applyRealtimeUpdate(update: RealtimeUpdate<'score'>): 'applied' | 'refresh' | 'ignore' {
		// フォールバックポーリング・キャッチアップ(data なし)は全取得
		if (update.source === 'poll' || !hasScoreUpdate(update.data)) return 'refresh';
		return applyScorePayload(update.data.score);
	}

	type ScoreActionResult = {
		error?: string;
		scorePayload?: LiveTopicPayloadMap['score'];
	};

	async function applyScoreAction(run: () => Promise<ScoreActionResult>) {
		try {
			const result = await run();
			if (result.error) {
				toast.error(result.error);
				return;
			}
			if (result.scorePayload && applyScorePayload(result.scorePayload) === 'refresh') {
				await invalidateAll();
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : '操作に失敗しました');
		}
	}

	// 自分の操作はフォーム結果の payload で即時反映する(WS 断でも遅延しない)
	$effect(() => {
		const payload = (formResult as { scorePayload?: LiveTopicPayloadMap['score'] } | undefined)
			?.scorePayload;
		if (!payload) return;
		if (applyScorePayload(payload) === 'refresh') void invalidateAll();
	});

	const courtSideSchema = v.picklist(['left', 'right']);
	const manualChangeCountSchema = v.pipe(v.number(), v.integer(), v.minValue(0));

	let currentGame = $derived(
		matchState.games.find((game) => game.gameNo === matchState.currentGameNo)
	);

	let isLocked = $derived(matchState.status === 'confirmed');
	let isScoringLocked = $derived(isLocked || !!data.match.winnerConfirmedAt);
	let scoreActionPending = $derived(rallyWonCommand.pending > 0 || undoCommand.pending > 0);

	const undoableEventTypes = ['rally_won', 'match_started', 'game_started'];
	let lastUndoableEvent = $derived(findLastUndoableEvent(matchEvents, undoableEventTypes));

	function undoLabel(e: (typeof matchEvents)[number]): string {
		return buildUndoLabel(
			e as unknown as Parameters<typeof buildUndoLabel>[0],
			sideAName,
			sideBName,
			{ left: leftSide, right: rightSide }
		);
	}

	let sideAPlayers = $derived(data.players.filter((player) => player.side === 'A'));
	let sideBPlayers = $derived(data.players.filter((player) => player.side === 'B'));
	let sideAName = $derived(data.match.sides.find((side) => side.side === 'A')?.displayName ?? 'A');
	let sideBName = $derived(data.match.sides.find((side) => side.side === 'B')?.displayName ?? 'B');
	let savedRefereeName = $derived(data.match.refereeName ?? '');
	let winnerConfirmed = $derived(!!data.match.winnerConfirmedAt);
	let hasRefereeName = $derived(!!savedRefereeName.trim());
	let winnerSideName = $derived(
		matchState.winnerSide === 'A' ? sideAName : matchState.winnerSide === 'B' ? sideBName : null
	);
	let scoreText = $derived(
		matchState.games.some((g) => g.winnerSide !== null)
			? matchState.games
					.filter((g) => g.winnerSide !== null)
					.map((g) => `${g.score[leftSide]}-${g.score[rightSide]}`)
					.join(', ')
			: null
	);

	let previousGameWinner = $derived(
		matchState.games.find((g) => g.gameNo === matchState.currentGameNo - 1)?.winnerSide
	);
	let allPlayerItems = $derived(
		previousGameWinner === 'B'
			? [...playerOptions(sideBPlayers), ...playerOptions(sideAPlayers)]
			: [...playerOptions(sideAPlayers), ...playerOptions(sideBPlayers)]
	);
	let bFirstPlayerItems = $derived(
		previousGameWinner === 'B'
			? [...playerOptions(sideAPlayers), ...playerOptions(sideBPlayers)]
			: [...playerOptions(sideBPlayers), ...playerOptions(sideAPlayers)]
	);

	// ── Change-of-ends tracking ────────────────────────────────────────────────
	let courtSideKey = $derived(`referee_side_${matchState.matchId}`);
	let manualChangeCountKey = $derived(`referee_changecount_${matchState.matchId}`);
	let sideAStartsLeft = $state(true);

	let manualChangeCount = $state(0);

	onMount(() => {
		const stored = loadJsonFromLocalStorage(courtSideKey, courtSideSchema);
		if (stored === 'right') setSideAStartsLeft(false);
		else if (stored === 'left') setSideAStartsLeft(true);

		manualChangeCount =
			loadJsonFromLocalStorage(manualChangeCountKey, manualChangeCountSchema) ?? 0;
	});

	function setSideAStartsLeft(val: boolean) {
		sideAStartsLeft = val;
		saveJsonToLocalStorage(courtSideKey, courtSideSchema, val ? 'left' : 'right');
	}

	function doChangeEnds() {
		manualChangeCount += 1;
		saveJsonToLocalStorage(manualChangeCountKey, manualChangeCountSchema, manualChangeCount);
	}

	let sideAIsLeft = $derived(manualChangeCount % 2 === 0 ? sideAStartsLeft : !sideAStartsLeft);

	let initialServerPlayerId = $state('');
	let initialReceiverPlayerId = $state('');

	let leftSide = $derived(sideAIsLeft ? ('A' as const) : ('B' as const));
	let rightSide = $derived(sideAIsLeft ? ('B' as const) : ('A' as const));
	let leftSideName = $derived(sideAIsLeft ? sideAName : sideBName);
	let rightSideName = $derived(sideAIsLeft ? sideBName : sideAName);
	let leftSidePlayers = $derived(sideAIsLeft ? sideAPlayers : sideBPlayers);
	let rightSidePlayers = $derived(sideAIsLeft ? sideBPlayers : sideAPlayers);

	let leftAccent = $derived<'pink' | 'cyan'>(leftSide === 'A' ? 'pink' : 'cyan');
	let rightAccent = $derived<'pink' | 'cyan'>(leftSide === 'A' ? 'cyan' : 'pink');

	let prevError: string | undefined;
	let prevSavedRefereeName: string | null = null;
	$effect(() => {
		const failure = formResult as { error?: string } | undefined;
		const err = failure?.error;
		if (err && err !== prevError) {
			toast.error(err);
			prevError = err;
		}
	});

	$effect(() => {
		const savedName = data.match.refereeName?.trim() ?? '';
		if (!savedName) return;
		if (savedName === prevSavedRefereeName) return;
		toast.success('審判名を保存しました');
		prevSavedRefereeName = savedName;
	});
</script>

<RealtimeSync
	topics={['score']}
	channel={matchChannel(matchState.matchId)}
	refresh={() => invalidateAll()}
	applyUpdate={applyRealtimeUpdate}
	debounceMs={0}
/>

{#snippet scoreCard(
	side: 'A' | 'B',
	name: string,
	teamName: string | null | undefined,
	score: number,
	accent: 'pink' | 'cyan',
	serviceActive: boolean
)}
	<Card
		class={cn(
			serviceActive && ['border-2', accent === 'pink' ? 'border-pink-500' : 'border-cyan-500']
		)}
		innerClass="flex flex-col h-full"
	>
		<p class="text-sm font-medium text-muted-foreground grow">{name}</p>
		{#if teamName}
			<p class="text-xs text-muted">{teamName}</p>
		{/if}
		<p class="mt-1 text-5xl leading-none font-bold tabular-nums sm:text-7xl">{score}</p>
		<div class="mt-4">
			<LongPressButton
				type="button"
				class={cn(
					'h-20 w-full rounded-2xl text-2xl font-bold text-white active:scale-95 disabled:bg-zinc-200 disabled:text-muted',
					accent === 'pink' ? 'bg-pink-600 hover:bg-pink-700' : 'bg-cyan-600 hover:bg-cyan-700'
				)}
				disabled={matchState.status !== 'playing' || isScoringLocked || scoreActionPending}
				onclick={() => applyScoreAction(() => rallyWonCommand({ side }))}
				onLongPress={() => applyScoreAction(() => rallyWonCommand({ side }))}
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
	<div class="text-center text-xs text-muted">
		第{matchState.currentGameNo}ゲーム · ゲームカウント {matchState.gamesWon[leftSide]}–{matchState
			.gamesWon[rightSide]}
	</div>

	<!-- Match finished banner -->
	{#if isConfirmableMatchStatus(matchState.status)}
		<RefereeMatchFinishedCard
			status={matchState.status as 'finished' | 'forfeited' | 'retired'}
			refereeName={savedRefereeName}
			{winnerSideName}
			{winnerConfirmed}
			{hasRefereeName}
			{isLocked}
			{isScoringLocked}
			{scoreText}
		/>
	{/if}

	<!-- Start game form -->
	{#if matchState.status === 'scheduled' || matchState.status === 'interval'}
		<Card>
			<h2 class="mb-3 font-semibold">
				{matchState.status === 'scheduled' ? '試合開始' : '次ゲーム開始'}
			</h2>

			<div class="mb-4">
				<CourtSideToggle
					leftTeamName={leftSidePlayers[0]?.teamName}
					rightTeamName={rightSidePlayers[0]?.teamName}
					leftPlayers={leftSidePlayers.map((p) => p.name)}
					rightPlayers={rightSidePlayers.map((p) => p.name)}
					accentLeft={leftAccent}
					accentRight={rightAccent}
					label="エンドを入れ替える"
					ontoggle={doChangeEnds}
				/>
			</div>

			{#if matchState.status === 'scheduled'}
				<form {...start} class="grid gap-3 sm:grid-cols-2">
					<div class="grid gap-1">
						<span class="text-xs font-medium text-muted-foreground">1st サーバー</span>
						<AppSelect
							name="initialServerPlayerId"
							bind:value={initialServerPlayerId}
							items={allPlayerItems}
							required
						/>
					</div>
					<div class="grid gap-1">
						<span class="text-xs font-medium text-muted-foreground">1st レシーバー</span>
						<AppSelect
							name="initialReceiverPlayerId"
							bind:value={initialReceiverPlayerId}
							items={bFirstPlayerItems}
							required
						/>
					</div>
					<div class="sm:col-span-2">
						<AppButton type="submit">開始</AppButton>
					</div>
				</form>
			{:else}
				<form {...startGame} class="grid gap-3 sm:grid-cols-2">
					<input type="hidden" name="gameNo" value={matchState.currentGameNo} />
					<div class="grid gap-1">
						<span class="text-xs font-medium text-muted-foreground">1st サーバー</span>
						<AppSelect
							name="initialServerPlayerId"
							bind:value={initialServerPlayerId}
							items={allPlayerItems}
							required
						/>
					</div>
					<div class="grid gap-1">
						<span class="text-xs font-medium text-muted-foreground">1st レシーバー</span>
						<AppSelect
							name="initialReceiverPlayerId"
							bind:value={initialReceiverPlayerId}
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
			{/if}
		</Card>
	{/if}

	<!-- Score + tap buttons -->
	<div class="grid grid-cols-2 gap-3">
		{@render scoreCard(
			leftSide,
			leftSideName,
			leftSidePlayers[0]?.teamName,
			currentGame?.score[leftSide] ?? 0,
			leftAccent,
			matchState.service?.servingSide === leftSide
		)}
		{@render scoreCard(
			rightSide,
			rightSideName,
			rightSidePlayers[0]?.teamName,
			currentGame?.score[rightSide] ?? 0,
			rightAccent,
			matchState.service?.servingSide === rightSide
		)}
	</div>

	<!-- Change-of-ends -->
	<CourtSideToggle ontoggle={doChangeEnds} />
	<!-- Undo button -->
	<AppButton
		class="flex w-full flex-col rounded-xl bg-zinc-950 px-3 py-2.5 text-left text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-muted disabled:opacity-50"
		type="button"
		disabled={!lastUndoableEvent || isScoringLocked || scoreActionPending}
		onclick={() => applyScoreAction(() => undoCommand())}
	>
		<span class="flex items-center gap-1 text-xs text-zinc-300">
			<Undo2 class="size-3" />取り消し
		</span>
		<span class="block leading-tight wrap-break-word">
			{lastUndoableEvent ? undoLabel(lastUndoableEvent) : '—'}
		</span>
	</AppButton>

	<!-- Court diagram -->
	<RefereeCourtDiagram
		service={matchState.service}
		{sideAIsLeft}
		{leftAccent}
		{rightAccent}
		{leftSidePlayers}
		{rightSidePlayers}
		players={data.players}
	/>

	<!-- Scoresheet -->
	<RefereeScoresheet events={matchEvents} games={matchState.games} players={data.players} />

	<!-- Advanced controls -->
	{#if !isScoringLocked}
		<RefereeAdvancedControls {sideAName} {sideBName} {applyScoreAction} />
	{/if}

	<!-- Event log -->
	<RefereeEventLog events={matchEvents} />
</div>
