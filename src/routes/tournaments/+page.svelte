<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>大会一覧</title>
</svelte:head>

<main class="min-h-screen bg-zinc-50 px-4 py-6 text-zinc-950 sm:px-6">
	<div class="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_360px]">
		<section>
			<div class="mb-4">
				<div>
					<h1 class="text-2xl font-semibold">大会一覧</h1>
					<p class="text-sm text-zinc-600">ライブスコア管理対象の大会</p>
				</div>
			</div>

			{#if data.tournaments.length === 0}
				<p
					class="rounded-md border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-600"
				>
					大会はまだ作成されていません。
				</p>
			{:else}
				<div class="grid gap-3">
					{#each data.tournaments as tournament (tournament.id)}
						<a
							class="rounded-md border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-400"
							href={resolve('/tournaments/[tournamentId]', { tournamentId: tournament.id })}
						>
							<div class="flex items-start justify-between gap-3">
								<div>
									<h2 class="font-semibold">{tournament.name}</h2>
									<p class="mt-1 text-sm text-zinc-600">{tournament.venue ?? '会場未設定'}</p>
								</div>
								<span class="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-700">
									{tournament.status}
								</span>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</section>

		<form
			method="POST"
			action="?/create"
			class="rounded-md border border-zinc-200 bg-white p-4 shadow-sm"
		>
			<h2 class="mb-4 text-lg font-semibold">大会作成</h2>
			{#if form?.message}
				<p class="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{form.message}</p>
			{/if}
			<label class="grid gap-1 text-sm font-medium">
				大会名
				<input class="rounded-md border border-zinc-300 px-3 py-2" name="name" required />
			</label>
			<label class="mt-3 grid gap-1 text-sm font-medium">
				会場
				<input class="rounded-md border border-zinc-300 px-3 py-2" name="venue" />
			</label>
			<div class="mt-3 grid grid-cols-2 gap-3">
				<label class="grid gap-1 text-sm font-medium">
					開始日
					<input class="rounded-md border border-zinc-300 px-3 py-2" name="startsAt" type="date" />
				</label>
				<label class="grid gap-1 text-sm font-medium">
					終了日
					<input class="rounded-md border border-zinc-300 px-3 py-2" name="endsAt" type="date" />
				</label>
			</div>
			<button
				class="mt-5 w-full rounded-md bg-zinc-900 px-4 py-3 font-medium text-white"
				type="submit"
			>
				作成
			</button>
		</form>
	</div>
</main>
