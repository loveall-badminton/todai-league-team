<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import Card from '$lib/components/Card.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import CourtSideToggle from '$lib/components/CourtSideToggle.svelte';
	import LongPressButton from '$lib/components/LongPressButton.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import RealtimeSync from '$lib/components/RealtimeSync.svelte';
	import { matchChannel } from '$lib/realtime/channels';
	import { matchStatusLabel } from '$lib/domain/tokyoLeagueLabels';
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

	let { data }: PageProps = $props();

	const courtSideSchema = v.picklist(['left', 'right']);
	const manualChangeCountSchema = v.pipe(v.number(), v.integer(), v.minValue(0));

	let currentGame = $derived(
		data.state.games.find((game) => game.gameNo === data.state.currentGameNo)
	);
	let canEditService = $derived(
		data.state.status === 'playing' &&
			(currentGame?.score.A ?? 0) === 0 &&
			(currentGame?.score.B ?? 0) === 0
	);

	let isLocked = $derived(data.state.status === 'confirmed');
	let isTerminal = $derived(['finished', 'forfeited', 'retired'].includes(data.state.status));

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

	function playerName(id: string | null | undefined): string {
		return data.players.find((player) => player.id === id)?.name ?? '-';
	}

	let allPlayerItems = $derived([...playerOptions(sideAPlayers), ...playerOptions(sideBPlayers)]);
	let bFirstPlayerItems = $derived([
		...playerOptions(sideBPlayers),
		...playerOptions(sideAPlayers)
	]);

	// ── Change-of-ends tracking ────────────────────────────────────────────────
	// Persisted to localStorage by matchId. true = side A starts on the left.
	let courtSideKey = $derived(`referee_side_${data.state.matchId}`);
	let manualChangeCountKey = $derived(`referee_changecount_${data.state.matchId}`);
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

	async function run(fn: () => Promise<unknown>) {
		try {
			await fn();
			await invalidateAll();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : '操作に失敗しました');
		}
	}

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
		<p class="mt-1 text-5xl leading-none font-bold tabular-nums sm:text-7xl">{score}</p>
		<div class="mt-4">
			<LongPressButton
				class={cn(
					'h-20 w-full rounded-2xl text-2xl font-bold text-white active:scale-95 disabled:bg-zinc-200 disabled:text-zinc-400',
					accent === 'pink' ? 'bg-pink-600 hover:bg-pink-700' : 'bg-cyan-600 hover:bg-cyan-700'
				)}
				disabled={data.state.status !== 'playing' || isLocked}
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
	<Card>
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
		<Card>
			<h2 class="mb-3 font-semibold">
				{data.state.status === 'scheduled' ? '試合開始' : '次ゲーム開始'}
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

	<!-- Change-of-ends -->
	<CourtSideToggle ontoggle={doChangeEnds} />

	<!-- Service info -->
	<Card>
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
					{#if data.state.service}
						{data.state.service?.servingSide === 'A'
							? sideAName
							: data.state.service?.servingSide === 'B'
								? sideBName
								: '-'}が{data.state.service?.serviceCourt == 'right'
							? '右'
							: data.state.service?.serviceCourt == 'left'
								? '左'
								: '-'}からサーブ
					{:else}
						-
					{/if}
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
	<Card>
		<h2 class="mb-3 text-xs font-medium tracking-wide text-zinc-400">操作</h2>
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
			<AppButton
				class="col-span-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 sm:col-span-1"
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
		games={data.state.games}
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
			service={data.state.service}
			players={data.players}
			currentGameNo={data.state.currentGameNo}
			onRun={run}
		/>
	{/if}

	<!-- Event log -->
	<RefereeEventLog events={data.events} />

	<!-- WebSocket: 別端末の操作を反映 -->
	<RealtimeSync
		channel={matchChannel(data.match.id)}
		topics={[]}
		onUpdate={() => invalidateAll()}
	/>
</div>
