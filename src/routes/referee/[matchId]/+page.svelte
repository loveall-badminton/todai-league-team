<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import AppButton from '$lib/components/AppButton.svelte';
	import Card from '$lib/components/Card.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import CourtSideToggle from '$lib/components/CourtSideToggle.svelte';
	import LongPressButton from '$lib/components/LongPressButton.svelte';
	import RealtimeSync from '$lib/components/RealtimeSync.svelte';
	import { hasScoreUpdate, matchChannel } from '$lib/realtime/channels';
	import { createRealtimeQueryFlow } from '$lib/realtime/queryFlow';
	import type { RealtimeUpdate } from '$lib/realtime/updates';
	import { cn } from '$lib/utils/cn';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { PageProps } from './$types';
	import RefereeAdvancedControls from './RefereeAdvancedControls.svelte';
	import RefereeCourtDiagram from './RefereeCourtDiagram.svelte';
	import RefereeEventLog from './RefereeEventLog.svelte';
	import RefereeScoresheet from './RefereeScoresheet.svelte';
	import { confirm, rallyWon, resume, start, startGame, suspend, undo } from './referee.remote';
	import { loadJsonFromLocalStorage, saveJsonToLocalStorage } from '$lib/utils/localStorage';
	import {
		undoLabel as buildUndoLabel,
		findLastUndoableEvent,
		playerOptions
	} from './refereeUtils';
	import * as v from 'valibot';
	import AppSelect from '$lib/components/AppSelect.svelte';

	let { data }: PageProps = $props();

	const courtSideSchema = v.picklist(['left', 'right']);
	const manualChangeCountSchema = v.pipe(v.number(), v.integer(), v.minValue(0));

	// ブロードキャストで受け取ったスコアデータで即時更新するためのローカルステート。
	// invalidateAll() のたびに data.state から再同期する（$effect 参照）。
	// svelte-ignore state_referenced_locally
	let localState = $state(data.state);

	let currentGame = $derived(
		localState.games.find((game) => game.gameNo === localState.currentGameNo)
	);

	let isLocked = $derived(localState.status === 'confirmed');
	let isTerminal = $derived(['finished', 'forfeited', 'retired'].includes(localState.status));

	// Undo: find last undoable event that hasn't been undone yet
	const undoableEventTypes = [
		'rally_won',
		'correction_applied',
		'match_suspended',
		'match_resumed',
		'match_started',
		'game_started'
	];
	let lastUndoableEvent = $derived(findLastUndoableEvent(data.events, undoableEventTypes));

	function undoLabel(e: (typeof data.events)[number]): string {
		return buildUndoLabel(e, sideAName, sideBName);
	}

	let sideAPlayers = $derived(data.players.filter((player) => player.side === 'A'));
	let sideBPlayers = $derived(data.players.filter((player) => player.side === 'B'));
	let sideAName = $derived(data.match.sides.find((side) => side.side === 'A')?.displayName ?? 'A');
	let sideBName = $derived(data.match.sides.find((side) => side.side === 'B')?.displayName ?? 'B');

	let allPlayerItems = $derived([...playerOptions(sideAPlayers), ...playerOptions(sideBPlayers)]);
	let bFirstPlayerItems = $derived([
		...playerOptions(sideBPlayers),
		...playerOptions(sideAPlayers)
	]);

	// ── Change-of-ends tracking ────────────────────────────────────────────────
	// Persisted to localStorage by matchId. true = side A starts on the left.
	let courtSideKey = $derived(`referee_side_${localState.matchId}`);
	let manualChangeCountKey = $derived(`referee_changecount_${localState.matchId}`);
	let sideAStartsLeft = $state(true);

	// Manual change-of-ends counter (persisted to localStorage)
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

	// invalidateAll などで data.state が変わったら localState も同期する
	$effect(() => {
		const s = data.state;
		if (s) localState = structuredClone(s);
	});

	async function run(fn: () => Promise<unknown>) {
		try {
			await fn();
			await invalidateAll();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : '操作に失敗しました');
		}
	}

	const handleRealtimeUpdate = createRealtimeQueryFlow({
		refresh: () => invalidateAll(),
		applyUpdate: (update: RealtimeUpdate) => {
			if (!hasScoreUpdate(update.data)) return 'refresh';
			localState = update.data.score.state;
			return 'applied';
		}
	});

	// WebSocket 接続と自動更新は RealtimeSync コンポーネントが管理する。
	// テンプレートの <RealtimeSync> を参照。
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
		class={cn(
			serviceActive && ['border-2', accent === 'pink' ? 'border-pink-500' : 'border-cyan-500']
		)}
	>
		<p class="text-sm font-medium text-zinc-500">{name}</p>
		{#if teamName}
			<p class="text-xs text-zinc-400">{teamName}</p>
		{/if}
		<p class="mt-1 text-5xl leading-none font-bold tabular-nums sm:text-7xl">{score}</p>
		<div class="mt-4">
			<LongPressButton
				class={cn(
					'h-20 w-full rounded-2xl text-2xl font-bold text-white active:scale-95 disabled:bg-zinc-200 disabled:text-zinc-400',
					accent === 'pink' ? 'bg-pink-600 hover:bg-pink-700' : 'bg-cyan-600 hover:bg-cyan-700'
				)}
				disabled={localState.status !== 'playing' || isLocked}
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
	<div class="text-center text-xs text-zinc-400">
		第{localState.currentGameNo}ゲーム · セットカウント {localState.gamesWon[leftSide]}–{localState
			.gamesWon[rightSide]}
	</div>

	<!-- Start game form -->
	{#if localState.status === 'scheduled' || localState.status === 'interval'}
		<Card>
			<h2 class="mb-3 font-semibold">
				{localState.status === 'scheduled' ? '試合開始' : '次ゲーム開始'}
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

			<form
				onsubmit={async (e) => {
					e.preventDefault();
					const fd = new FormData(e.currentTarget as HTMLFormElement);
					await run(async () => {
						const initialServerPlayerId = String(fd.get('initialServerPlayerId') ?? '');
						const initialReceiverPlayerId = String(fd.get('initialReceiverPlayerId') ?? '');
						if (localState.status === 'scheduled') {
							await start({ initialServerPlayerId, initialReceiverPlayerId });
						} else {
							await startGame({
								gameNo: localState.currentGameNo,
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
						value={localState.service?.serverPlayerId ?? ''}
						items={allPlayerItems}
						required
					/>
				</div>
				<div class="grid gap-1">
					<span class="text-xs font-medium text-zinc-500">1st レシーバー</span>
					<AppSelect
						name="initialReceiverPlayerId"
						value={localState.service?.receiverPlayerId ?? ''}
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
			localState.service?.servingSide === leftSide
		)}
		{@render scoreCard(
			rightSide,
			rightSideName,
			rightSidePlayers[0]?.teamName,
			currentGame?.score[rightSide] ?? 0,
			rightAccent,
			localState.service?.servingSide === rightSide
		)}
	</div>

	<!-- Change-of-ends -->
	<CourtSideToggle ontoggle={doChangeEnds} />

	<!-- Court diagram -->
	<RefereeCourtDiagram
		service={localState.service}
		{sideAIsLeft}
		{leftAccent}
		{rightAccent}
		{leftSidePlayers}
		{rightSidePlayers}
		players={data.players}
	/>

	<!-- Controls -->
	<Card>
		<div class="grid grid-cols-2 gap-2">
			<AppButton
				class="flex flex-col col-span-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
				type="button"
				disabled={!lastUndoableEvent || isLocked}
				onclick={() => run(() => undo({}))}
			>
				<span class="block text-xs text-zinc-400">取り消し</span>
				<span class="block leading-tight wrap-break-word">
					{lastUndoableEvent ? undoLabel(lastUndoableEvent) : '—'}
				</span>
			</AppButton>
			<AppButton
				variant="warning"
				class="w-full"
				type="button"
				disabled={isLocked}
				onclick={() => run(() => suspend({ reason: 'referee_decision' }))}
			>
				中断
			</AppButton>
			<AppButton
				variant="success"
				class="w-full"
				type="button"
				disabled={isLocked}
				onclick={() => run(() => resume({}))}
			>
				再開
			</AppButton>
			<ConfirmDialog
				onConfirm={() => run(() => confirm())}
				triggerLabel="結果確定"
				triggerVariant="primary"
				triggerFullWidth
				triggerClass="col-span-2"
				disabled={!isTerminal || isLocked}
				title="結果を確定しますか？"
				description="確定後は通常の審判操作では変更できません。スコアと勝者を確認してください。"
				confirmLabel="結果を確定する"
			/>
		</div>
	</Card>

	<!-- Scoresheet -->
	<RefereeScoresheet
		events={data.events}
		games={localState.games}
		{sideAPlayers}
		{sideBPlayers}
		players={data.players}
	/>

	<!-- Advanced controls -->
	{#if !isLocked}
		<RefereeAdvancedControls
			{currentGame}
			{sideAName}
			{sideBName}
			service={localState.service}
			players={data.players}
			currentGameNo={localState.currentGameNo}
		/>
	{/if}

	<!-- Event log -->
	<RefereeEventLog events={data.events} />

	<!-- WebSocket: 別端末の操作を反映 -->
	<RealtimeSync
		channel={matchChannel(data.match.id)}
		topics={[]}
		onUpdate={(u) => void handleRealtimeUpdate(u)}
	/>
</div>
