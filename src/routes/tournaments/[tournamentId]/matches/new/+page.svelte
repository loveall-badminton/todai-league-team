<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let discipline = $state('MS');
	let isDoubles = $derived(discipline === 'MD' || discipline === 'WD' || discipline === 'XD');
</script>

<svelte:head>
	<title>試合作成</title>
</svelte:head>

<main class="min-h-screen bg-zinc-50 px-4 py-6 text-zinc-950 sm:px-6">
	<form
		method="POST"
		class="mx-auto grid max-w-3xl gap-5 rounded-md border border-zinc-200 bg-white p-5 shadow-sm"
	>
		<header>
			<a
				class="text-sm text-zinc-600 hover:text-zinc-950"
				href={resolve('/tournaments/[tournamentId]', { tournamentId: data.tournament.id })}
			>
				{data.tournament.name}
			</a>
			<h1 class="mt-1 text-2xl font-semibold">試合作成</h1>
		</header>

		{#if form?.message}
			<p class="rounded-md bg-red-50 p-3 text-sm text-red-700">{form.message}</p>
		{/if}

		<div class="grid gap-4 sm:grid-cols-2">
			<label class="grid gap-1 text-sm font-medium">
				コート
				<select class="rounded-md border border-zinc-300 px-3 py-2" name="courtId">
					<option value="">未設定</option>
					{#each data.courts as court (court.id)}
						<option value={court.id}>{court.name}</option>
					{/each}
				</select>
			</label>
			<label class="grid gap-1 text-sm font-medium">
				種目
				<select
					class="rounded-md border border-zinc-300 px-3 py-2"
					name="discipline"
					bind:value={discipline}
				>
					{#each data.disciplines as item (item)}
						<option value={item}>{item}</option>
					{/each}
				</select>
			</label>
			<label class="grid gap-1 text-sm font-medium">
				イベント名
				<input class="rounded-md border border-zinc-300 px-3 py-2" name="eventName" />
			</label>
			<label class="grid gap-1 text-sm font-medium">
				カテゴリ
				<input class="rounded-md border border-zinc-300 px-3 py-2" name="category" />
			</label>
			<label class="grid gap-1 text-sm font-medium">
				ラウンド
				<input class="rounded-md border border-zinc-300 px-3 py-2" name="roundName" />
			</label>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<section class="rounded-md border border-zinc-200 p-4">
				<h2 class="font-semibold">Side A</h2>
				<label class="mt-3 grid gap-1 text-sm font-medium">
					選手1
					<input
						class="rounded-md border border-zinc-300 px-3 py-2"
						name="sideAPlayer1Name"
						required
					/>
				</label>
				<label class="mt-3 grid gap-1 text-sm font-medium">
					選手2
					<input
						class="rounded-md border border-zinc-300 px-3 py-2"
						name="sideAPlayer2Name"
						required={isDoubles}
					/>
				</label>
			</section>
			<section class="rounded-md border border-zinc-200 p-4">
				<h2 class="font-semibold">Side B</h2>
				<label class="mt-3 grid gap-1 text-sm font-medium">
					選手1
					<input
						class="rounded-md border border-zinc-300 px-3 py-2"
						name="sideBPlayer1Name"
						required
					/>
				</label>
				<label class="mt-3 grid gap-1 text-sm font-medium">
					選手2
					<input
						class="rounded-md border border-zinc-300 px-3 py-2"
						name="sideBPlayer2Name"
						required={isDoubles}
					/>
				</label>
			</section>
		</div>

		<button class="rounded-md bg-zinc-900 px-4 py-3 font-medium text-white" type="submit">
			作成して審判画面へ
		</button>
	</form>
</main>
