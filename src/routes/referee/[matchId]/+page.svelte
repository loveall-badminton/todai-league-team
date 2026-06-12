<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import type { MatchPlayer } from '$lib/domain/types';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import AppTextarea from '$lib/components/AppTextarea.svelte';

	let { data, form }: PageProps = $props();

	const currentGame = $derived(
		data.state.games.find((game) => game.gameNo === data.state.currentGameNo)
	);
	const sideAPlayers = $derived(data.players.filter((player) => player.side === 'A'));
	const sideBPlayers = $derived(data.players.filter((player) => player.side === 'B'));
	const sideAName = $derived(
		data.match.sides.find((side) => side.side === 'A')?.displayName ?? 'A'
	);
	const sideBName = $derived(
		data.match.sides.find((side) => side.side === 'B')?.displayName ?? 'B'
	);
	const sides = ['A', 'B'] as const;
	const reversedEvents = $derived([...data.events].reverse());
	const courtAssignmentsJson = $derived(
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

	// Controlled select states
	let initialServerPlayerId = $state('');
	let initialReceiverPlayerId = $state('');
	let correctionServingSide = $state(data.state.service?.servingSide ?? '');
	let correctionServiceCourt = $state(data.state.service?.serviceCourt ?? '');
	let correctionServerPlayerId = $state(data.state.service?.serverPlayerId ?? '');
	let correctionReceiverPlayerId = $state(data.state.service?.receiverPlayerId ?? '');
	let letReason = $state('receiver_not_ready');

	const allPlayerItems = $derived([
		...playerOptions(sideAPlayers),
		...playerOptions(sideBPlayers)
	]);
	const bFirstPlayerItems = $derived([
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
	const allPlayerCorrectionItems = $derived([
		{ value: '', label: 'サーバー変更なし' },
		...data.players.map((p) => ({ value: p.id, label: p.name }))
	]);
	const allReceiverCorrectionItems = $derived([
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

	// Build scoresheet data from events, grouped by game
	const scoresheetByGame = $derived.by(() => {
		const scoring = [...data.events]
			.filter((e) => e.scoreAAfter !== null && e.scoreBAfter !== null)
			.sort((a, b) => a.seqNo - b.seqNo);

		const games: Array<{
			aPoints: Array<{ point: number; opponentScore: number }>;
			bPoints: Array<{ point: number; opponentScore: number }>;
		}> = [];

		let aPoints: typeof games[0]['aPoints'] = [];
		let bPoints: typeof games[0]['bPoints'] = [];
		let prevA = 0;
		let prevB = 0;

		for (const e of scoring) {
			const a = e.scoreAAfter ?? 0;
			const b = e.scoreBAfter ?? 0;
			// Detect game boundary: combined score went down (reset to 0)
			if ((aPoints.length > 0 || bPoints.length > 0) && a + b < prevA + prevB) {
				games.push({ aPoints, bPoints });
				aPoints = [];
				bPoints = [];
				prevA = 0;
				prevB = 0;
			}
			if (a > prevA) aPoints.push({ point: a, opponentScore: b });
			if (b > prevB) bPoints.push({ point: b, opponentScore: a });
			prevA = a;
			prevB = b;
		}
		if (aPoints.length > 0 || bPoints.length > 0) games.push({ aPoints, bPoints });
		return games;
	});
</script>

<svelte:head>
	<title>スコア入力 | 東大リーグ団体戦</title>
</svelte:head>

<main class="min-h-screen bg-zinc-50 px-4 py-6 text-zinc-950 sm:px-6">
	<div class="mx-auto grid max-w-3xl gap-4">

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
						{data.match.court?.name ?? 'コート未設定'} ·
						ゲーム {data.state.currentGameNo} ·
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
			{#if form?.message}
				<p class="mt-3 rounded-xl bg-zinc-100 px-4 py-2 text-sm text-zinc-700">{form.message}</p>
			{/if}
		</header>

		<!-- Score + tap buttons -->
		<div class="grid grid-cols-2 gap-3">
			<div class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
				<div class="flex items-center gap-2">
					<p class="text-sm font-medium text-zinc-500">{sideAName}</p>
					{#if data.state.service?.servingSide === 'A'}
						<span class="size-2.5 rounded-full bg-emerald-500" title="サーブ権あり"></span>
					{/if}
				</div>
				<p class="mt-1 text-7xl leading-none font-bold tabular-nums">{currentGame?.score.A ?? 0}</p>
				<form method="POST" action="?/rallyWon" class="mt-4">
					<input name="side" type="hidden" value="A" />
					<button
						class="h-20 w-full rounded-2xl bg-emerald-600 text-2xl font-bold text-white hover:bg-emerald-700 active:scale-95 disabled:bg-zinc-200 disabled:text-zinc-400"
						type="submit"
						disabled={data.state.status !== 'playing'}
					>
						+1
					</button>
				</form>
			</div>
			<div class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
				<div class="flex items-center gap-2">
					<p class="text-sm font-medium text-zinc-500">{sideBName}</p>
					{#if data.state.service?.servingSide === 'B'}
						<span class="size-2.5 rounded-full bg-sky-500" title="サーブ権あり"></span>
					{/if}
				</div>
				<p class="mt-1 text-7xl leading-none font-bold tabular-nums">{currentGame?.score.B ?? 0}</p>
				<form method="POST" action="?/rallyWon" class="mt-4">
					<input name="side" type="hidden" value="B" />
					<button
						class="h-20 w-full rounded-2xl bg-sky-600 text-2xl font-bold text-white hover:bg-sky-700 active:scale-95 disabled:bg-zinc-200 disabled:text-zinc-400"
						type="submit"
						disabled={data.state.status !== 'playing'}
					>
						+1
					</button>
				</form>
			</div>
		</div>

		<!-- Scoresheet view -->
		{#if showScoresheet}
			<section class="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
				<div class="border-b border-zinc-100 px-5 py-3">
					<h2 class="text-sm font-medium text-zinc-700">スコアシート</h2>
					<p class="mt-0.5 text-xs text-zinc-400">各欄の数字は得点時の自チーム得点（括弧内は相手得点）</p>
				</div>
				{#each scoresheetByGame as game, gi (gi)}
					<div class="px-5 py-4 {gi > 0 ? 'border-t border-zinc-100' : ''}">
						<p class="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
							第{gi + 1}ゲーム
						</p>
						<div class="grid grid-cols-2 gap-4">
							<!-- A side -->
							<div>
								<p class="mb-2 text-center text-sm font-semibold text-emerald-700">{sideAName}</p>
								<div class="flex flex-wrap gap-1">
									{#each game.aPoints as pt (pt.point)}
										<span class="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
											{pt.point}<span class="ml-0.5 text-emerald-400">({pt.opponentScore})</span>
										</span>
									{/each}
									{#if game.aPoints.length === 0}
										<span class="text-xs text-zinc-400">—</span>
									{/if}
								</div>
							</div>
							<!-- B side -->
							<div>
								<p class="mb-2 text-center text-sm font-semibold text-sky-700">{sideBName}</p>
								<div class="flex flex-wrap gap-1">
									{#each game.bPoints as pt (pt.point)}
										<span class="rounded-lg bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800">
											{pt.point}<span class="ml-0.5 text-sky-400">({pt.opponentScore})</span>
										</span>
									{/each}
									{#if game.bPoints.length === 0}
										<span class="text-xs text-zinc-400">—</span>
									{/if}
								</div>
							</div>
						</div>
					</div>
				{:else}
					<div class="px-5 py-8 text-center text-sm text-zinc-400">
						得点データがありません
					</div>
				{/each}
			</section>
		{/if}

		<!-- Service info -->
		<section class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
			<h2 class="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">サービス情報</h2>
			<div class="grid gap-3 sm:grid-cols-3">
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
				<h2 class="mb-4 text-xs font-medium uppercase tracking-wide text-zinc-400">コート配置</h2>
				<!-- Court diagram: B at top (far), A at bottom (near). -->
				<!-- Left/Right are from each side's perspective facing the net. -->
				<!-- Diagram left column: B-right / A-left  |  Diagram right column: B-left / A-right -->
				<div class="mx-auto max-w-xs">
					<div class="relative overflow-hidden rounded-xl border-2 border-zinc-300">
						<!-- B side (top half): faces down → B-right = screen left, B-left = screen right -->
						<div class="grid grid-cols-2 divide-x divide-zinc-200">
							<div class="flex min-h-[4.5rem] flex-col items-center justify-center gap-1 p-3 text-center
								{server === ca.B.right ? 'bg-sky-50' : receiver === ca.B.right ? 'bg-zinc-50' : ''}">
								{#if server === ca.B.right}
									<span class="text-xs font-medium text-sky-600">S</span>
								{:else if receiver === ca.B.right}
									<span class="text-xs text-zinc-400">R</span>
								{:else}
									<span class="text-xs text-zinc-300">—</span>
								{/if}
								<p class="text-sm font-medium text-zinc-800 leading-tight">{playerName(ca.B.right)}</p>
								<p class="text-[10px] text-zinc-400">{sideBName} 右</p>
							</div>
							<div class="flex min-h-[4.5rem] flex-col items-center justify-center gap-1 p-3 text-center
								{server === ca.B.left ? 'bg-sky-50' : receiver === ca.B.left ? 'bg-zinc-50' : ''}">
								{#if server === ca.B.left}
									<span class="text-xs font-medium text-sky-600">S</span>
								{:else if receiver === ca.B.left}
									<span class="text-xs text-zinc-400">R</span>
								{:else}
									<span class="text-xs text-zinc-300">—</span>
								{/if}
								<p class="text-sm font-medium text-zinc-800 leading-tight">{playerName(ca.B.left)}</p>
								<p class="text-[10px] text-zinc-400">{sideBName} 左</p>
							</div>
						</div>

						<!-- Net -->
						<div class="relative flex items-center border-y-2 border-zinc-400 bg-zinc-100 py-1">
							<div class="flex-1 border-t border-dashed border-zinc-300"></div>
							<span class="shrink-0 px-2 text-[10px] font-medium uppercase tracking-widest text-zinc-400">NET</span>
							<div class="flex-1 border-t border-dashed border-zinc-300"></div>
						</div>

						<!-- A side (bottom half): faces up → A-right = screen right, A-left = screen left -->
						<div class="grid grid-cols-2 divide-x divide-zinc-200">
							<div class="flex min-h-[4.5rem] flex-col items-center justify-center gap-1 p-3 text-center
								{server === ca.A.left ? 'bg-emerald-50' : receiver === ca.A.left ? 'bg-zinc-50' : ''}">
								<p class="text-sm font-medium text-zinc-800 leading-tight">{playerName(ca.A.left)}</p>
								<p class="text-[10px] text-zinc-400">{sideAName} 左</p>
								{#if server === ca.A.left}
									<span class="text-xs font-medium text-emerald-600">S</span>
								{:else if receiver === ca.A.left}
									<span class="text-xs text-zinc-400">R</span>
								{/if}
							</div>
							<div class="flex min-h-[4.5rem] flex-col items-center justify-center gap-1 p-3 text-center
								{server === ca.A.right ? 'bg-emerald-50' : receiver === ca.A.right ? 'bg-zinc-50' : ''}">
								<p class="text-sm font-medium text-zinc-800 leading-tight">{playerName(ca.A.right)}</p>
								<p class="text-[10px] text-zinc-400">{sideAName} 右</p>
								{#if server === ca.A.right}
									<span class="text-xs font-medium text-emerald-600">S</span>
								{:else if receiver === ca.A.right}
									<span class="text-xs text-zinc-400">R</span>
								{/if}
							</div>
						</div>
					</div>
					<p class="mt-2 text-center text-[10px] text-zinc-400">S = サーバー　R = レシーバー</p>
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
					method="POST"
					action={data.state.status === 'scheduled' ? '?/start' : '?/startGame'}
					class="grid gap-3 sm:grid-cols-2"
				>
					{#if data.state.status === 'interval'}
						<input name="gameNo" type="hidden" value={data.state.currentGameNo} />
					{/if}
					<div class="grid gap-1">
						<span class="text-xs font-medium text-zinc-500">初期サーバー</span>
						<AppSelect
							name="initialServerPlayerId"
							bind:value={initialServerPlayerId}
							items={allPlayerItems}
							required
						/>
					</div>
					<div class="grid gap-1">
						<span class="text-xs font-medium text-zinc-500">初期レシーバー</span>
						<AppSelect
							name="initialReceiverPlayerId"
							bind:value={initialReceiverPlayerId}
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
			<h2 class="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">操作</h2>
			<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
				<form method="POST" action="?/undo">
					<button
						class="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
						type="submit"
					>
						取り消し
					</button>
				</form>
				<form method="POST" action="?/suspend">
					<input name="reason" type="hidden" value="referee_decision" />
					<button
						class="w-full rounded-xl bg-amber-100 px-3 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-200"
						type="submit"
					>
						中断
					</button>
				</form>
				<form method="POST" action="?/resume">
					<button
						class="w-full rounded-xl bg-emerald-100 px-3 py-2.5 text-sm font-medium text-emerald-800 hover:bg-emerald-200"
						type="submit"
					>
						再開
					</button>
				</form>
				<form method="POST" action="?/confirm">
					<button
						class="w-full rounded-xl bg-zinc-950 px-3 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
						type="submit"
					>
						結果確定
					</button>
				</form>
			</div>
		</section>

		<!-- Advanced: correction / let / forfeit / retire -->
		<section class="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
			<h2
				class="border-b border-zinc-100 px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-400"
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
					<form method="POST" action="?/correction" class="grid gap-3 px-5 pb-4">
						<input name="gameNo" type="hidden" value={data.state.currentGameNo} />
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
							<div class="grid gap-2 px-3 pb-3 pt-1">
								<AppSelect
									name="servingSide"
									bind:value={correctionServingSide}
									items={servingSideItems}
								/>
								<AppSelect
									name="serviceCourt"
									bind:value={correctionServiceCourt}
									items={serviceCourtItems}
								/>
								<AppSelect
									name="serverPlayerId"
									bind:value={correctionServerPlayerId}
									items={allPlayerCorrectionItems}
								/>
								<AppSelect
									name="receiverPlayerId"
									bind:value={correctionReceiverPlayerId}
									items={allReceiverCorrectionItems}
								/>
								{#if data.state.service?.discipline === 'doubles'}
									<AppTextarea
										name="courtAssignmentsJson"
										class="min-h-20 font-mono text-xs"
									>{courtAssignmentsJson}</AppTextarea>
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
					<form method="POST" action="?/letCalled" class="grid gap-3 px-5 pb-4">
						<AppSelect name="reason" bind:value={letReason} items={letReasonItems} />
						<AppInput name="note" placeholder="メモ" />
						<button
							class="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
							type="submit"
						>
							記録する
						</button>
					</form>
				</details>

				<!-- Forfeit -->
				<details>
					<summary
						class="cursor-pointer list-none px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 [&::-webkit-details-marker]:hidden"
					>
						棄権
					</summary>
					<form method="POST" action="?/forfeit" class="grid grid-cols-2 gap-2 px-5 pb-4">
						<button
							class="rounded-xl bg-red-100 px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-200"
							name="side"
							value="A"
						>
							{sideAName} 棄権
						</button>
						<button
							class="rounded-xl bg-red-100 px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-200"
							name="side"
							value="B"
						>
							{sideBName} 棄権
						</button>
					</form>
				</details>

				<!-- Retire -->
				<details>
					<summary
						class="cursor-pointer list-none px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 [&::-webkit-details-marker]:hidden"
					>
						リタイア
					</summary>
					<form method="POST" action="?/retire" class="grid grid-cols-2 gap-2 px-5 pb-4">
						<button
							class="rounded-xl bg-red-100 px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-200"
							name="side"
							value="A"
						>
							{sideAName} リタイア
						</button>
						<button
							class="rounded-xl bg-red-100 px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-200"
							name="side"
							value="B"
						>
							{sideBName} リタイア
						</button>
					</form>
				</details>

			</div>
		</section>

		<!-- Event log -->
		<section class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
			<h2 class="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">イベントログ</h2>
			<div class="max-h-72 space-y-1.5 overflow-auto">
				{#each reversedEvents as event (event.id)}
					<div
						class="grid grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2 text-sm"
					>
						<span class="tabular-nums text-zinc-400">#{event.seqNo}</span>
						<span class="text-zinc-700">{event.eventType}</span>
						<span class="tabular-nums font-medium text-zinc-500">
							{event.scoreAAfter ?? '-'}–{event.scoreBAfter ?? '-'}
						</span>
					</div>
				{/each}
			</div>
		</section>

	</div>
</main>
