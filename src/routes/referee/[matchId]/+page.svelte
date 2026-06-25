<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import Card from '$lib/components/Card.svelte';
	import CourtSideToggle from '$lib/components/CourtSideToggle.svelte';
	import LongPressButton from '$lib/components/LongPressButton.svelte';
	import { cn } from '$lib/utils/cn';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { PageProps } from './$types';
	import RefereeAdvancedControls from './RefereeAdvancedControls.svelte';
	import RefereeCourtDiagram from './RefereeCourtDiagram.svelte';
	import RefereeEventLog from './RefereeEventLog.svelte';
	import RefereeScoresheet from './RefereeScoresheet.svelte';
	import { rallyWon, start, startGame, undo } from './referee.remote';
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

	const courtSideSchema = v.picklist(['left', 'right']);
	const manualChangeCountSchema = v.pipe(v.number(), v.integer(), v.minValue(0));

	let currentGame = $derived(
		data.state.games.find((game) => game.gameNo === data.state.currentGameNo)
	);

	let isLocked = $derived(data.state.status === 'confirmed');

	const undoableEventTypes = ['rally_won', 'match_started', 'game_started'];
	let lastUndoableEvent = $derived(findLastUndoableEvent(data.events, undoableEventTypes));

	function undoLabel(e: (typeof data.events)[number]): string {
		if (e.eventType === 'rally_won') {
			const name = e.side === 'A' ? sideAName : e.side === 'B' ? sideBName : '?';
			return `${name} 得点 (${e.scoreAAfter ?? '?'}–${e.scoreBAfter ?? '?'})`;
		}
		return buildUndoLabel(
			e as unknown as Parameters<typeof buildUndoLabel>[0],
			sideAName,
			sideBName
		);
	}

	let sideAPlayers = $derived(data.players.filter((player) => player.side === 'A'));
	let sideBPlayers = $derived(data.players.filter((player) => player.side === 'B'));
	let sideAName = $derived(data.match.sides.find((side) => side.side === 'A')?.displayName ?? 'A');
	let sideBName = $derived(data.match.sides.find((side) => side.side === 'B')?.displayName ?? 'B');

	let previousGameWinner = $derived(
		data.state.games.find((g) => g.gameNo === data.state.currentGameNo - 1)?.winnerSide
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
	let courtSideKey = $derived(`referee_side_${data.state.matchId}`);
	let manualChangeCountKey = $derived(`referee_changecount_${data.state.matchId}`);
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

	let prevError = $state<string | undefined>();
	$effect(() => {
		const failure = formResult as { error?: string } | undefined;
		const err = failure?.error;
		if (err && err !== prevError) {
			toast.error(err);
			prevError = err;
		}
	});
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
		innerClass="flex flex-col h-full"
	>
		<p class="text-sm font-medium text-muted-foreground grow">{name}</p>
		{#if teamName}
			<p class="text-xs text-muted">{teamName}</p>
		{/if}
		<p class="mt-1 text-5xl leading-none font-bold tabular-nums sm:text-7xl">{score}</p>
		<div class="mt-4">
			<form {...rallyWon.for(side)}>
				<input {...rallyWon.fields.side.as('hidden', side)} />
				<LongPressButton
					class={cn(
						'h-20 w-full rounded-2xl text-2xl font-bold text-white active:scale-95 disabled:bg-zinc-200 disabled:text-muted',
						accent === 'pink' ? 'bg-pink-600 hover:bg-pink-700' : 'bg-cyan-600 hover:bg-cyan-700'
					)}
					disabled={data.state.status !== 'playing' || isLocked}
					onShortPress={() => toast.info('得点を記録するには長押ししてください')}
				>
					+1
				</LongPressButton>
			</form>
		</div>
	</Card>
{/snippet}

<svelte:head>
	<title>スコア入力 | 東大リーグ団体戦</title>
</svelte:head>

<div class="grid gap-4">
	<!-- Header -->
	<div class="text-center text-xs text-muted">
		第{data.state.currentGameNo}ゲーム · ゲームカウント {data.state.gamesWon[leftSide]}–{data.state
			.gamesWon[rightSide]}
	</div>

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

			{#if data.state.status === 'scheduled'}
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
					<input type="hidden" name="gameNo" value={data.state.currentGameNo} />
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
		<form {...undo} class="contents">
			<AppButton
				class="flex flex-col w-full rounded-xl border border-border bg-white px-3 py-2.5 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
				type="submit"
				disabled={!lastUndoableEvent || isLocked}
			>
				<span class="text-xs text-muted flex items-center gap-1">
					<Undo2 class="size-3" />取り消し
				</span>
				<span class="block leading-tight wrap-break-word">
					{lastUndoableEvent ? undoLabel(lastUndoableEvent) : '—'}
				</span>
			</AppButton>
		</form>
	</Card>

	<!-- Scoresheet -->
	<RefereeScoresheet events={data.events} games={data.state.games} players={data.players} />

	<!-- Advanced controls -->
	{#if !isLocked}
		<RefereeAdvancedControls {sideAName} {sideBName} />
	{/if}

	<!-- Event log -->
	<RefereeEventLog events={data.events} />
</div>
