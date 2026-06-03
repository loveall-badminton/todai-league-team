<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import type { MatchPlayer } from '$lib/domain/types';

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
</script>

<svelte:head>
	<title>審判入力</title>
</svelte:head>

<main class="min-h-screen bg-zinc-950 px-3 py-4 text-white sm:px-6">
	<div class="mx-auto grid max-w-5xl gap-4">
		<header class="rounded-md bg-zinc-900 p-4">
			<div class="flex flex-wrap justify-between gap-3">
				<div>
					<a
						class="text-sm text-zinc-400 hover:text-white"
						href={resolve('/tournaments/[tournamentId]', { tournamentId: data.match.tournamentId })}
					>
						大会詳細
					</a>
					<h1 class="mt-1 text-xl font-semibold">
						{sideAName} vs {sideBName}
					</h1>
					<p class="text-sm text-zinc-400">
						{data.match.court?.name ?? 'コート未設定'} / Game {data.state.currentGameNo} / {data
							.state.status}
						/ seq {data.state.lastSeqNo}
					</p>
				</div>
				<div class="text-right">
					<p class="text-sm text-zinc-400">Games</p>
					<p class="text-2xl font-semibold">{data.state.gamesWon.A} - {data.state.gamesWon.B}</p>
				</div>
			</div>
			{#if form?.message}
				<p class="mt-3 rounded-md bg-zinc-800 p-3 text-sm text-zinc-100">{form.message}</p>
			{/if}
		</header>

		<section class="grid grid-cols-2 gap-3">
			<div class="rounded-md bg-white p-4 text-zinc-950">
				<p class="text-sm font-medium text-zinc-600">{sideAName}</p>
				<p class="mt-2 text-7xl leading-none font-semibold">{currentGame?.score.A ?? 0}</p>
				<form method="POST" action="?/rallyWon" class="mt-4">
					<input name="side" type="hidden" value="A" />
					<button
						class="h-24 w-full rounded-md bg-emerald-600 text-3xl font-semibold text-white disabled:bg-zinc-300"
						type="submit"
						disabled={data.state.status !== 'playing'}
					>
						A +1
					</button>
				</form>
			</div>
			<div class="rounded-md bg-white p-4 text-zinc-950">
				<p class="text-sm font-medium text-zinc-600">{sideBName}</p>
				<p class="mt-2 text-7xl leading-none font-semibold">{currentGame?.score.B ?? 0}</p>
				<form method="POST" action="?/rallyWon" class="mt-4">
					<input name="side" type="hidden" value="B" />
					<button
						class="h-24 w-full rounded-md bg-sky-600 text-3xl font-semibold text-white disabled:bg-zinc-300"
						type="submit"
						disabled={data.state.status !== 'playing'}
					>
						B +1
					</button>
				</form>
			</div>
		</section>

		<section class="grid gap-3 rounded-md bg-zinc-900 p-4 sm:grid-cols-3">
			<div>
				<p class="text-xs text-zinc-500 uppercase">サーバー</p>
				<p class="text-lg font-semibold">{playerName(data.state.service?.serverPlayerId)}</p>
			</div>
			<div>
				<p class="text-xs text-zinc-500 uppercase">レシーバー</p>
				<p class="text-lg font-semibold">{playerName(data.state.service?.receiverPlayerId)}</p>
			</div>
			<div>
				<p class="text-xs text-zinc-500 uppercase">サービスコート</p>
				<p class="text-lg font-semibold">
					{data.state.service?.servingSide ?? '-'} / {data.state.service?.serviceCourt ?? '-'}
				</p>
			</div>
		</section>

		{#if data.state.service?.discipline === 'doubles'}
			<section class="grid gap-3 rounded-md bg-zinc-900 p-4 sm:grid-cols-2">
				{#each sides as side (side)}
					<div class="rounded-md border border-zinc-700 p-3">
						<p class="mb-2 font-semibold">Side {side}</p>
						<div class="grid grid-cols-2 gap-2 text-sm">
							<div class="rounded bg-zinc-800 p-2">
								<p class="text-zinc-500">右</p>
								<p>{playerName(data.state.service.courtAssignments[side].right)}</p>
							</div>
							<div class="rounded bg-zinc-800 p-2">
								<p class="text-zinc-500">左</p>
								<p>{playerName(data.state.service.courtAssignments[side].left)}</p>
							</div>
						</div>
					</div>
				{/each}
			</section>
		{/if}

		{#if data.state.status === 'scheduled'}
			<form method="POST" action="?/start" class="rounded-md bg-zinc-900 p-4">
				<h2 class="mb-3 font-semibold">試合開始</h2>
				<div class="grid gap-3 sm:grid-cols-2">
					<label class="grid gap-1 text-sm">
						初期サーバー
						<select
							class="rounded-md px-3 py-2 text-zinc-950"
							name="initialServerPlayerId"
							required
						>
							{#each [...playerOptions(sideAPlayers), ...playerOptions(sideBPlayers)] as player (player.value)}
								<option value={player.value}>{player.label}</option>
							{/each}
						</select>
					</label>
					<label class="grid gap-1 text-sm">
						初期レシーバー
						<select
							class="rounded-md px-3 py-2 text-zinc-950"
							name="initialReceiverPlayerId"
							required
						>
							{#each [...playerOptions(sideBPlayers), ...playerOptions(sideAPlayers)] as player (player.value)}
								<option value={player.value}>{player.label}</option>
							{/each}
						</select>
					</label>
				</div>
				<button class="mt-4 rounded-md bg-white px-4 py-3 font-medium text-zinc-950" type="submit">
					開始
				</button>
			</form>
		{/if}

		{#if data.state.status === 'interval'}
			<form method="POST" action="?/startGame" class="rounded-md bg-zinc-900 p-4">
				<h2 class="mb-3 font-semibold">次ゲーム開始</h2>
				<input name="gameNo" type="hidden" value={data.state.currentGameNo} />
				<div class="grid gap-3 sm:grid-cols-2">
					<label class="grid gap-1 text-sm">
						初期サーバー
						<select
							class="rounded-md px-3 py-2 text-zinc-950"
							name="initialServerPlayerId"
							required
						>
							{#each [...playerOptions(sideAPlayers), ...playerOptions(sideBPlayers)] as player (player.value)}
								<option value={player.value}>{player.label}</option>
							{/each}
						</select>
					</label>
					<label class="grid gap-1 text-sm">
						初期レシーバー
						<select
							class="rounded-md px-3 py-2 text-zinc-950"
							name="initialReceiverPlayerId"
							required
						>
							{#each [...playerOptions(sideBPlayers), ...playerOptions(sideAPlayers)] as player (player.value)}
								<option value={player.value}>{player.label}</option>
							{/each}
						</select>
					</label>
				</div>
				<button class="mt-4 rounded-md bg-white px-4 py-3 font-medium text-zinc-950" type="submit">
					開始
				</button>
			</form>
		{/if}

		<section class="grid gap-3 rounded-md bg-zinc-900 p-4">
			<h2 class="font-semibold">操作</h2>
			<div class="grid gap-2 sm:grid-cols-4">
				<form method="POST" action="?/undo">
					<button
						class="w-full rounded-md bg-zinc-100 px-4 py-3 font-medium text-zinc-950"
						type="submit"
					>
						Undo
					</button>
				</form>
				<form method="POST" action="?/suspend">
					<input name="reason" type="hidden" value="referee_decision" />
					<button
						class="w-full rounded-md bg-amber-500 px-4 py-3 font-medium text-zinc-950"
						type="submit"
					>
						中断
					</button>
				</form>
				<form method="POST" action="?/resume">
					<button
						class="w-full rounded-md bg-emerald-500 px-4 py-3 font-medium text-zinc-950"
						type="submit"
					>
						再開
					</button>
				</form>
				<form method="POST" action="?/confirm">
					<button
						class="w-full rounded-md bg-white px-4 py-3 font-medium text-zinc-950"
						type="submit"
					>
						結果確定
					</button>
				</form>
			</div>
		</section>

		<section class="grid gap-3 lg:grid-cols-3">
			<details class="rounded-md bg-zinc-900 p-4">
				<summary class="cursor-pointer font-semibold">Correction</summary>
				<form method="POST" action="?/correction" class="mt-3 grid gap-3">
					<input name="gameNo" type="hidden" value={data.state.currentGameNo} />
					<div class="grid grid-cols-2 gap-2">
						<input
							class="rounded-md px-3 py-2 text-zinc-950"
							name="scoreA"
							type="number"
							value={currentGame?.score.A ?? 0}
						/>
						<input
							class="rounded-md px-3 py-2 text-zinc-950"
							name="scoreB"
							type="number"
							value={currentGame?.score.B ?? 0}
						/>
					</div>
					<input
						class="rounded-md px-3 py-2 text-zinc-950"
						name="reason"
						placeholder="理由"
						required
					/>
					<button class="rounded-md bg-white px-4 py-2 font-medium text-zinc-950" type="submit">
						訂正
					</button>
					<details class="rounded-md border border-zinc-700 p-3">
						<summary class="cursor-pointer text-sm font-medium">サービス状態も訂正</summary>
						<div class="mt-3 grid gap-2">
							<select class="rounded-md px-3 py-2 text-zinc-950" name="servingSide">
								<option value="">変更なし</option>
								<option value="A" selected={data.state.service?.servingSide === 'A'}>A</option>
								<option value="B" selected={data.state.service?.servingSide === 'B'}>B</option>
							</select>
							<select class="rounded-md px-3 py-2 text-zinc-950" name="serviceCourt">
								<option value="">変更なし</option>
								<option value="right" selected={data.state.service?.serviceCourt === 'right'}>
									右
								</option>
								<option value="left" selected={data.state.service?.serviceCourt === 'left'}
									>左</option
								>
							</select>
							<select class="rounded-md px-3 py-2 text-zinc-950" name="serverPlayerId">
								<option value="">変更なし</option>
								{#each data.players as player (player.id)}
									<option
										value={player.id}
										selected={data.state.service?.serverPlayerId === player.id}
									>
										{player.name}
									</option>
								{/each}
							</select>
							<select class="rounded-md px-3 py-2 text-zinc-950" name="receiverPlayerId">
								<option value="">変更なし</option>
								{#each data.players as player (player.id)}
									<option
										value={player.id}
										selected={data.state.service?.receiverPlayerId === player.id}
									>
										{player.name}
									</option>
								{/each}
							</select>
							{#if data.state.service?.discipline === 'doubles'}
								<textarea
									class="min-h-24 rounded-md px-3 py-2 font-mono text-xs text-zinc-950"
									name="courtAssignmentsJson">{courtAssignmentsJson}</textarea
								>
							{/if}
						</div>
					</details>
				</form>
			</details>

			<details class="rounded-md bg-zinc-900 p-4">
				<summary class="cursor-pointer font-semibold">レット</summary>
				<form method="POST" action="?/letCalled" class="mt-3 grid gap-3">
					<select class="rounded-md px-3 py-2 text-zinc-950" name="reason">
						<option value="receiver_not_ready">レシーバー未準備</option>
						<option value="both_faulted">双方フォルト</option>
						<option value="shuttle_caught_on_net">ネットに引っかかった</option>
						<option value="shuttle_disintegrated">シャトル破損</option>
						<option value="line_judge_unsighted">線審視認不能</option>
						<option value="unforeseen_situation">予期しない状況</option>
						<option value="other">その他</option>
					</select>
					<input class="rounded-md px-3 py-2 text-zinc-950" name="note" placeholder="メモ" />
					<button class="rounded-md bg-white px-4 py-2 font-medium text-zinc-950" type="submit">
						記録
					</button>
				</form>
			</details>

			<details class="rounded-md bg-zinc-900 p-4">
				<summary class="cursor-pointer font-semibold">棄権</summary>
				<form method="POST" action="?/forfeit" class="mt-3 grid grid-cols-2 gap-2">
					<button
						class="rounded-md bg-red-600 px-4 py-3 font-medium text-white"
						name="side"
						value="A"
					>
						A棄権
					</button>
					<button
						class="rounded-md bg-red-600 px-4 py-3 font-medium text-white"
						name="side"
						value="B"
					>
						B棄権
					</button>
				</form>
			</details>

			<details class="rounded-md bg-zinc-900 p-4">
				<summary class="cursor-pointer font-semibold">リタイア</summary>
				<form method="POST" action="?/retire" class="mt-3 grid grid-cols-2 gap-2">
					<button
						class="rounded-md bg-red-600 px-4 py-3 font-medium text-white"
						name="side"
						value="A"
					>
						Aリタイア
					</button>
					<button
						class="rounded-md bg-red-600 px-4 py-3 font-medium text-white"
						name="side"
						value="B"
					>
						Bリタイア
					</button>
				</form>
			</details>
		</section>

		<section class="rounded-md bg-zinc-900 p-4">
			<h2 class="mb-3 font-semibold">イベントログ</h2>
			<div class="grid max-h-72 gap-2 overflow-auto text-sm">
				{#each reversedEvents as event (event.id)}
					<div class="grid grid-cols-[64px_1fr_auto] gap-2 rounded bg-zinc-800 p-2">
						<span>#{event.seqNo}</span>
						<span>{event.eventType}</span>
						<span>{event.scoreAAfter ?? '-'}-{event.scoreBAfter ?? '-'}</span>
					</div>
				{/each}
			</div>
		</section>
	</div>
</main>
