<script lang="ts">
	import { resolve } from '$app/paths';
	import { RUBBER_DEFINITIONS } from '$lib/domain/tokyoLeague';
	import { rubberLabel, submissionStatusLabel } from '$lib/domain/tokyoLeagueLabels';
	import FormMessage from '$lib/components/FormMessage.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Player = { id: string; name: string };
	type Item = { rubberCode: string; player1Id: string | null; player2Id: string | null };

	const statusBadgeClass = (status: string | null | undefined) => {
		const map: Record<string, string> = {
			draft: 'bg-zinc-100 text-zinc-600',
			submitted: 'bg-blue-100 text-blue-700',
			locked: 'bg-violet-100 text-violet-700',
			revealed: 'bg-emerald-100 text-emerald-700'
		};
		return status ? (map[status] ?? 'bg-zinc-100 text-zinc-500') : 'bg-zinc-100 text-zinc-400';
	};

	const playerName = (players: Player[], id: string | null) =>
		id ? (players.find((p) => p.id === id)?.name ?? id) : null;

	const bothReadyToReveal = $derived(
		['submitted', 'locked'].includes(data.submissionA?.status ?? '') &&
			['submitted', 'locked'].includes(data.submissionB?.status ?? '')
	);
	const isRevealed = $derived(
		data.submissionA?.status === 'revealed' || data.submissionB?.status === 'revealed'
	);
</script>

<svelte:head>
	<title>{data.tie.tieCode} オーダー確認 | 東大リーグ団体戦</title>
</svelte:head>

<main class="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-950 sm:px-6">
	<div class="mx-auto max-w-6xl space-y-6">

		<!-- Header -->
		<header>
			<a
				class="text-sm text-zinc-500 hover:text-zinc-700"
				href={resolve('/ties/[tieId]', { tieId: data.tie.id })}
			>
				← {data.tie.tieCode}
			</a>
			<h1 class="mt-1 text-2xl font-semibold tracking-tight">オーダー確認</h1>
		</header>

		<FormMessage message={form?.message} />

		<!-- Global actions: reveal/unreveal -->
		<section class="rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
			<div class="flex flex-wrap items-center justify-between gap-4">
				<p class="text-sm text-zinc-500">
					両チームのオーダーを承認後、公開できます。
				</p>
				<div class="flex gap-2">
					{#if isRevealed}
						<form method="POST" action="?/unreveal">
							<button
								class="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
							>
								公開を取り消す
							</button>
						</form>
					{:else if bothReadyToReveal}
						<form method="POST" action="?/reveal">
							<button
								class="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
							>
								オーダー公開
							</button>
						</form>
					{:else}
						<span class="self-center text-xs text-zinc-400">両チームの提出後に公開できます</span>
					{/if}
				</div>
			</div>
		</section>

		<!-- Team lineup cards -->
		<div class="grid gap-5 lg:grid-cols-2">
			{@render teamCard('A', data.teamA?.id ?? null, data.teamA?.name ?? 'A側', data.playersA, data.submissionA, data.itemsA)}
			{@render teamCard('B', data.teamB?.id ?? null, data.teamB?.name ?? 'B側', data.playersB, data.submissionB, data.itemsB)}
		</div>

	</div>
</main>

{#snippet teamCard(
	side: 'A' | 'B',
	teamId: string | null,
	teamName: string,
	players: Player[],
	submission: { status: string } | null,
	items: Item[]
)}
	<section class="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
		<!-- Card header -->
		<div class="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
			<div class="flex items-center gap-3">
				<h2 class="text-base font-semibold">{teamName}</h2>
				<span class="rounded-full px-2.5 py-0.5 text-xs font-medium {statusBadgeClass(submission?.status)}">
					{submissionStatusLabel(submission?.status)}
				</span>
			</div>

			<div class="flex items-center gap-2">
				<!-- Link to team input page -->
				{#if teamId}
					<a
						href={resolve('/ties/[tieId]/lineups/[teamId]', { tieId: data.tie.id, teamId })}
						class="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
					>
						入力ページ
					</a>
				{/if}

				<!-- Approve / unapprove -->
				{#if submission?.status === 'locked' || submission?.status === 'revealed'}
					{#if !isRevealed}
						<form method="POST" action="?/unlock">
							<input type="hidden" name="side" value={side} />
							<button
								class="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
							>
								承認を解除
							</button>
						</form>
					{/if}
				{:else if submission?.status === 'submitted'}
					<form method="POST" action="?/lock">
						<input type="hidden" name="side" value={side} />
						<button
							class="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100"
						>
							承認する
						</button>
					</form>
				{/if}
			</div>
		</div>

		<!-- Lineup display -->
		{#if !submission || submission.status === 'draft' || items.length === 0}
			<div class="px-5 py-8 text-center">
				<p class="text-sm text-zinc-400">
					{!submission ? '未提出' : '下書き中'}
				</p>
			</div>
		{:else}
			<div class="divide-y divide-zinc-100">
				{#each RUBBER_DEFINITIONS as rubber (rubber.code)}
					{@const item = items.find((i) => i.rubberCode === rubber.code)}
					<div class="grid grid-cols-[8rem_1fr] gap-3 px-5 py-3.5">
						<p class="pt-0.5 text-xs font-medium text-zinc-500">{rubberLabel(rubber.code)}</p>
						<div class="space-y-0.5">
							{#if item?.player1Id}
								<p class="text-sm">{playerName(players, item.player1Id)}</p>
							{:else}
								<p class="text-sm text-zinc-400">未入力</p>
							{/if}
							{#if item?.player2Id}
								<p class="text-sm">{playerName(players, item.player2Id)}</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>
{/snippet}
