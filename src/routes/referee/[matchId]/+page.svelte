<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import type { PageProps } from './$types';
	import type { MatchPlayer } from '$lib/domain/types';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import AppTextarea from '$lib/components/AppTextarea.svelte';
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

	let { data }: PageProps = $props();

	let cmdError = $state<string | null>(null);

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

	const statusLabel: Record<string, string> = {
		scheduled: '開始前',
		playing: '進行中',
		interval: 'インターバル',
		suspended: '中断中',
		finished: '終了',
		confirmed: '確定'
	};

	let letReason = $state('receiver_not_ready');
	let letNote = $state('');

	let allPlayerItems = $derived([...playerOptions(sideAPlayers), ...playerOptions(sideBPlayers)]);
	let bFirstPlayerItems = $derived([
		...playerOptions(sideBPlayers),
		...playerOptions(sideAPlayers)
	]);
	const servingSideItems = [
		{ value: '', label: 'サービスサイド変更なし' },
		{ value: 'A', label: 'A' },
		{ value: 'B', label: 'B' }
	];
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

	// Scoresheet toggle
	let showScoresheet = $state(false);

	async function run(fn: () => Promise<unknown>) {
		cmdError = null;
		try {
			await fn();
			await invalidateAll();
		} catch (e) {
			cmdError = e instanceof Error ? e.message : '操作に失敗しました';
		}
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
				games.push({
					gameNo: currentGameNo,
					serviceRuns: runs,
					finalScoreA: lastScoreA,
					finalScoreB: lastScoreB,
					winnerSide: data.state.games.find((g) => g.gameNo === currentGameNo)?.winnerSide ?? null
				});
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
			games.push({
				gameNo: currentGameNo,
				serviceRuns: runs,
				finalScoreA: lastScoreA,
				finalScoreB: lastScoreB,
				winnerSide: data.state.games.find((g) => g.gameNo === currentGameNo)?.winnerSide ?? null
			});
		}

		return games;
	});
</script>

{#snippet scoreCard(
	side: 'A' | 'B',
	name: string,
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
		<p class="mt-1 text-7xl leading-none font-bold tabular-nums">{score}</p>
		<div class="mt-4">
			<button
				class="h-20 w-full rounded-2xl {accent === 'emerald'
					? 'bg-emerald-600 hover:bg-emerald-700'
					: 'bg-sky-600 hover:bg-sky-700'} text-2xl font-bold text-white active:scale-95 disabled:bg-zinc-200 disabled:text-zinc-400"
				disabled={data.state.status !== 'playing'}
				onclick={() => run(() => rallyWon({ side }))}
			>
				+1
			</button>
		</div>
	</div>
{/snippet}

<svelte:head>
	<title>スコア入力 | 東大リーグ団体戦</title>
</svelte:head>

<div class="min-h-screen bg-zinc-50 px-4 py-6 text-zinc-950 sm:px-6">
	<div class="grid gap-4">
		<!-- Header -->
		<header class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
			<a
				class="text-sm text-zinc-500 hover:text-zinc-700"
				href={resolve('/tournaments/[tournamentId]', { tournamentId: data.match.tournamentId })}
			>
				← 大会詳細
			</a>
			<div class="mt-2 flex flex-wrap items-start justify-between gap-3">
				<div>
					<h1 class="text-xl font-semibold">{sideAName} vs {sideBName}</h1>
					<p class="mt-0.5 text-sm text-zinc-500">
						{data.match.court?.name ?? 'コート未設定'} · ゲーム {data.state.currentGameNo} ·
						{statusLabel[data.state.status] ?? data.state.status}
					</p>
				</div>
				<div class="flex items-center gap-3">
					<div class="text-right">
						<p class="text-xs text-zinc-400">ゲーム数</p>
						<p class="text-2xl font-bold tabular-nums">
							{data.state.gamesWon.A} – {data.state.gamesWon.B}
						</p>
					</div>
					<button
						onclick={() => (showScoresheet = !showScoresheet)}
						class="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
					>
						{showScoresheet ? 'シンプル' : 'スコアシート'}
					</button>
				</div>
			</div>
			{#if cmdError}
				<p class="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{cmdError}</p>
			{/if}
		</header>

		<!-- Score + tap buttons -->
		<div class="grid grid-cols-2 gap-3">
			{@render scoreCard(
				'A',
				sideAName,
				currentGame?.score.A ?? 0,
				'emerald',
				data.state.service?.servingSide === 'A'
			)}
			{@render scoreCard(
				'B',
				sideBName,
				currentGame?.score.B ?? 0,
				'sky',
				data.state.service?.servingSide === 'B'
			)}
		</div>

		<!-- Scoresheet view -->
		{#if showScoresheet}
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
										{@const playerRuns = game.serviceRuns.filter(
											(r) => r.serverPlayerId === player.id
										)}
										<tr
											class="border-b border-zinc-100
										{playerRuns.length > 0 ? '' : 'opacity-50'}"
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
										{@const playerRuns = game.serviceRuns.filter(
											(r) => r.serverPlayerId === player.id
										)}
										<tr
											class="border-b border-zinc-100
										{playerRuns.length > 0 ? '' : 'opacity-50'}"
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
		{/if}

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
				<div>
					<p class="text-xs text-zinc-500">サービスコート</p>
					<p class="mt-0.5 font-medium">
						{data.state.service?.servingSide ?? '-'} / {data.state.service?.serviceCourt ?? '-'}
					</p>
				</div>
			</div>
		</section>

		<!-- Doubles court assignments (visual) -->
		{#if data.state.service?.discipline === 'doubles'}
			{@const ca = data.state.service.courtAssignments}
			{@const server = data.state.service.serverPlayerId}
			{@const receiver = data.state.service.receiverPlayerId}
			<section class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
				<h2 class="mb-4 text-xs font-medium tracking-wide text-zinc-400">コート配置</h2>
				<div class="mx-auto max-w-xs">
					<div class="relative overflow-hidden rounded-xl border-2 border-zinc-300">
						<div class="grid grid-cols-2 divide-x divide-zinc-200">
							<div
								class="flex min-h-18 flex-col items-center justify-center gap-1 p-3 text-center
								{server === ca.B.right ? 'bg-sky-50' : receiver === ca.B.right ? 'bg-zinc-50' : ''}"
							>
								{#if server === ca.B.right}
									<span class="text-xs font-medium text-sky-600">S</span>
								{:else if receiver === ca.B.right}
									<span class="text-xs text-zinc-400">R</span>
								{:else}
									<span class="text-xs text-zinc-300">—</span>
								{/if}
								<p class="text-sm leading-tight font-medium text-zinc-800">
									{playerName(ca.B.right)}
								</p>
								<p class="text-[10px] text-zinc-400">{sideBName} 右</p>
							</div>
							<div
								class="flex min-h-18 flex-col items-center justify-center gap-1 p-3 text-center
								{server === ca.B.left ? 'bg-sky-50' : receiver === ca.B.left ? 'bg-zinc-50' : ''}"
							>
								{#if server === ca.B.left}
									<span class="text-xs font-medium text-sky-600">S</span>
								{:else if receiver === ca.B.left}
									<span class="text-xs text-zinc-400">R</span>
								{:else}
									<span class="text-xs text-zinc-300">—</span>
								{/if}
								<p class="text-sm leading-tight font-medium text-zinc-800">
									{playerName(ca.B.left)}
								</p>
								<p class="text-[10px] text-zinc-400">{sideBName} 左</p>
							</div>
						</div>

						<div class="relative flex items-center border-y-2 border-zinc-400 bg-zinc-100 py-1">
							<div class="flex-1 border-t border-dashed border-zinc-300"></div>
							<span class="shrink-0 px-2 text-[10px] font-medium tracking-widest text-zinc-400"
								>NET</span
							>
							<div class="flex-1 border-t border-dashed border-zinc-300"></div>
						</div>

						<div class="grid grid-cols-2 divide-x divide-zinc-200">
							<div
								class="flex min-h-18 flex-col items-center justify-center gap-1 p-3 text-center
								{server === ca.A.left ? 'bg-emerald-50' : receiver === ca.A.left ? 'bg-zinc-50' : ''}"
							>
								<p class="text-sm leading-tight font-medium text-zinc-800">
									{playerName(ca.A.left)}
								</p>
								<p class="text-[10px] text-zinc-400">{sideAName} 左</p>
								{#if server === ca.A.left}
									<span class="text-xs font-medium text-emerald-600">S</span>
								{:else if receiver === ca.A.left}
									<span class="text-xs text-zinc-400">R</span>
								{/if}
							</div>
							<div
								class="flex min-h-18 flex-col items-center justify-center gap-1 p-3 text-center
								{server === ca.A.right ? 'bg-emerald-50' : receiver === ca.A.right ? 'bg-zinc-50' : ''}"
							>
								<p class="text-sm leading-tight font-medium text-zinc-800">
									{playerName(ca.A.right)}
								</p>
								<p class="text-[10px] text-zinc-400">{sideAName} 右</p>
								{#if server === ca.A.right}
									<span class="text-xs font-medium text-emerald-600">S</span>
								{:else if receiver === ca.A.right}
									<span class="text-xs text-zinc-400">R</span>
								{/if}
							</div>
						</div>
					</div>
					<p class="mt-2 text-center text-[10px] text-zinc-400">S = サーバー / R = レシーバー</p>
				</div>
			</section>
		{/if}

		<!-- Start game form -->
		{#if data.state.status === 'scheduled' || data.state.status === 'interval'}
			<section class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
				<h2 class="mb-3 font-semibold">
					{data.state.status === 'scheduled' ? '試合開始' : '次ゲーム開始'}
				</h2>
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
						<button
							class="rounded-xl bg-zinc-950 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
							type="submit"
						>
							開始
						</button>
					</div>
				</form>
			</section>
		{/if}

		<!-- Controls -->
		<section class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
			<h2 class="mb-3 text-xs font-medium tracking-wide text-zinc-400">操作</h2>
			<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
				<button
					class="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
					onclick={() => run(() => undo({}))}
				>
					取り消し
				</button>
				<button
					class="w-full rounded-xl bg-amber-100 px-3 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-200"
					onclick={() => run(() => suspend({ reason: 'referee_decision' }))}
				>
					中断
				</button>
				<button
					class="w-full rounded-xl bg-emerald-100 px-3 py-2.5 text-sm font-medium text-emerald-800 hover:bg-emerald-200"
					onclick={() => run(() => resume({}))}
				>
					再開
				</button>
				<button
					class="w-full rounded-xl bg-zinc-950 px-3 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
					onclick={() => run(() => confirm())}
				>
					結果確定
				</button>
			</div>
		</section>

		<!-- Advanced: correction / let / forfeit / retire -->
		<section class="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
			<h2
				class="border-b border-zinc-100 px-5 py-3 text-xs font-medium tracking-wide text-zinc-400"
			>
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
						onsubmit={async (e) => {
							e.preventDefault();
							const fd = new FormData(e.currentTarget as HTMLFormElement);
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
						<button
							class="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
							type="submit"
						>
							訂正する
						</button>
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
						<button
							class="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
							onclick={() =>
								run(() => letCalled({ reason: letReason, note: letNote || undefined }))}
						>
							記録する
						</button>
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
						<button
							class="rounded-xl bg-red-100 px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-200"
							onclick={() => run(() => forfeit({ side: 'A' }))}
						>
							{sideAName} 棄権
						</button>
						<button
							class="rounded-xl bg-red-100 px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-200"
							onclick={() => run(() => forfeit({ side: 'B' }))}
						>
							{sideBName} 棄権
						</button>
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
						<button
							class="rounded-xl bg-red-100 px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-200"
							onclick={() => run(() => retire({ side: 'A' }))}
						>
							{sideAName} リタイア
						</button>
						<button
							class="rounded-xl bg-red-100 px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-200"
							onclick={() => run(() => retire({ side: 'B' }))}
						>
							{sideBName} リタイア
						</button>
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
						<span class="text-zinc-700">{event.eventType}</span>
						<span class="font-medium text-zinc-500 tabular-nums">
							{event.scoreAAfter ?? '-'}–{event.scoreBAfter ?? '-'}
						</span>
					</div>
				{/each}
			</div>
		</section>
	</div>
</div>
