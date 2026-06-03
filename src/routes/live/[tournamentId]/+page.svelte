<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.tournament.name} Live</title>
</svelte:head>

<main class="min-h-screen bg-zinc-950 px-4 py-6 text-white sm:px-6">
	<div class="mx-auto grid max-w-6xl gap-5">
		<header class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<h1 class="text-2xl font-semibold">{data.tournament.name}</h1>
				<p class="text-sm text-zinc-400">{data.tournament.venue ?? '会場未設定'} / ライブスコア</p>
			</div>
			<p class="rounded-md bg-zinc-900 px-3 py-2 text-sm text-zinc-300">手動更新</p>
		</header>

		<div class="grid gap-3">
			{#each data.matches as match (match.id)}
				<section class="rounded-md bg-white p-4 text-zinc-950 shadow-sm">
					<div class="flex flex-wrap justify-between gap-4">
						<div>
							<p class="text-sm text-zinc-600">
								{match.courtName ?? 'コート未設定'} / {match.discipline} / {match.status}
							</p>
							<h2 class="mt-1 text-lg font-semibold">{match.sideAName} vs {match.sideBName}</h2>
							<p class="text-sm text-zinc-600">
								{match.eventName ?? ''}
								{match.category ?? ''}
								{match.roundName ?? ''}
							</p>
						</div>
						<div class="min-w-44 text-right">
							<p class="text-5xl leading-none font-semibold">
								{match.currentScoreA} - {match.currentScoreB}
							</p>
							<p class="mt-1 text-sm text-zinc-600">
								Games {match.gamesWonA}-{match.gamesWonB} / Game {match.currentGameNo}
							</p>
						</div>
					</div>
					<div class="mt-3 grid gap-2 border-t border-zinc-200 pt-3 text-sm sm:grid-cols-3">
						<p>サーバー: {match.serverName ?? '-'}</p>
						<p>サーブ側: {match.currentServingSide ?? '-'}</p>
						<p>サービスコート: {match.currentServiceCourt ?? '-'}</p>
					</div>
				</section>
			{:else}
				<p class="rounded-md border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">
					表示できる試合はまだありません。
				</p>
			{/each}
		</div>
	</div>
</main>
