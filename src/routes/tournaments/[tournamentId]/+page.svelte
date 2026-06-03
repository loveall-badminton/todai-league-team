<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.tournament.name}</title>
</svelte:head>

<main class="min-h-screen bg-zinc-50 px-4 py-6 text-zinc-950 sm:px-6">
	<div class="mx-auto grid max-w-6xl gap-6">
		<header class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<a class="text-sm text-zinc-600 hover:text-zinc-950" href={resolve('/tournaments')}
					>大会一覧</a
				>
				<h1 class="mt-1 text-2xl font-semibold">{data.tournament.name}</h1>
				<p class="text-sm text-zinc-600">{data.tournament.venue ?? '会場未設定'}</p>
			</div>
			<div class="flex flex-wrap gap-2">
				<a
					class="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium"
					href={resolve('/live/[tournamentId]', { tournamentId: data.tournament.id })}
				>
					公開ライブ
				</a>
				<a
					class="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
					href={resolve('/tournaments/[tournamentId]/matches/new', {
						tournamentId: data.tournament.id
					})}
				>
					試合作成
				</a>
			</div>
		</header>

		<div class="grid gap-6 lg:grid-cols-[320px_1fr]">
			<section class="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
				<h2 class="text-lg font-semibold">コート</h2>
				<form method="POST" action="?/createCourt" class="mt-4 grid gap-3">
					{#if form?.message}
						<p class="rounded-md bg-zinc-100 p-3 text-sm">{form.message}</p>
					{/if}
					<label class="grid gap-1 text-sm font-medium">
						コート名
						<input class="rounded-md border border-zinc-300 px-3 py-2" name="name" required />
					</label>
					<label class="grid gap-1 text-sm font-medium">
						表示順
						<input
							class="rounded-md border border-zinc-300 px-3 py-2"
							name="displayOrder"
							type="number"
							value="0"
						/>
					</label>
					<button class="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white" type="submit">
						追加
					</button>
				</form>

				<div class="mt-5 grid gap-2">
					{#each data.courts as court (court.id)}
						<div class="rounded-md border border-zinc-200 px-3 py-2 text-sm">
							{court.name}
						</div>
					{:else}
						<p class="text-sm text-zinc-600">コートはまだありません。</p>
					{/each}
				</div>
			</section>

			<section>
				<h2 class="mb-3 text-lg font-semibold">試合</h2>
				<div class="grid gap-3">
					{#each data.matches as match (match.id)}
						<a
							class="rounded-md border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-400"
							href={resolve('/referee/[matchId]', { matchId: match.id })}
						>
							<div class="flex flex-wrap justify-between gap-3">
								<div>
									<p class="text-sm text-zinc-600">
										{match.courtName ?? 'コート未設定'} / {match.discipline}
									</p>
									<h3 class="font-semibold">{match.sideAName} vs {match.sideBName}</h3>
									<p class="text-sm text-zinc-600">
										{match.eventName ?? ''}
										{match.category ?? ''}
										{match.roundName ?? ''}
									</p>
								</div>
								<div class="text-right">
									<p class="text-2xl font-semibold">
										{match.currentScoreA} - {match.currentScoreB}
									</p>
									<p class="text-sm text-zinc-600">
										G {match.gamesWonA}-{match.gamesWonB} / {match.status}
									</p>
								</div>
							</div>
						</a>
					{:else}
						<p
							class="rounded-md border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-600"
						>
							試合はまだありません。
						</p>
					{/each}
				</div>
			</section>
		</div>
	</div>
</main>
