<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { RUBBER_DEFINITIONS } from '$lib/domain/tokyoLeague';
	import { rubberLabel, submissionStatusLabel } from '$lib/domain/tokyoLeagueLabels';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import type { PageProps } from './$types';
	import { saveDraft, submit } from './lineup.remote';

	let { data }: PageProps = $props();

	type Player = { id: string; name: string; gender: string };
	type Item = { rubberCode: string; player1Id: string | null; player2Id: string | null };

	let status = $derived(data.submission?.status ?? null);
	let isLocked = $derived(status === 'locked' || status === 'revealed');
	let isSubmitted = $derived(status === 'submitted');

	const savedValue = (code: string, order: 1 | 2) => {
		const item = data.items.find((i: Item) => i.rubberCode === code);
		return order === 1 ? (item?.player1Id ?? '') : (item?.player2Id ?? '');
	};

	const playerName = (id: string) => data.players.find((p: Player) => p.id === id)?.name ?? id;

	const statusBadgeClass = (s: string | null) => {
		const map: Record<string, string> = {
			draft: 'bg-zinc-100 text-zinc-600',
			submitted: 'bg-blue-100 text-blue-700',
			locked: 'bg-violet-100 text-violet-700',
			revealed: 'bg-emerald-100 text-emerald-700'
		};
		return s ? (map[s] ?? 'bg-zinc-100 text-zinc-500') : 'bg-zinc-100 text-zinc-400';
	};

	function filteredPlayers(discipline: string, order: 1 | 2): Player[] {
		return (data.players as Player[]).filter((p) => {
			if (p.gender === 'unknown') return true;
			if (discipline === 'WD') return p.gender === 'female';
			if (discipline === 'MD') return p.gender === 'male';
			if (discipline === 'XD') return order === 1 ? p.gender === 'female' : p.gender === 'male';
			return true;
		});
	}

	function slotLabel(discipline: string, order: 1 | 2): string {
		if (discipline === 'XD') return order === 1 ? '女性' : '男性';
		return `${order}人目`;
	}

	let cmdMessage = $state<string | null>(null);
	let cmdWarnings = $state<string[]>([]);
	let cmdError = $state<string | null>(null);
	let lineupAction = $state<'draft' | 'submit'>('draft');

	async function handleLineup(e: SubmitEvent) {
		e.preventDefault();
		const fd = new FormData(e.currentTarget as HTMLFormElement);
		const formData: Record<string, string> = {};
		for (const [key, val] of fd.entries()) {
			formData[key] = String(val);
		}
		cmdMessage = null;
		cmdWarnings = [];
		cmdError = null;
		try {
			let result: { message: string; warnings?: string[] } | undefined;
			if (lineupAction === 'draft') {
				result = await saveDraft(formData);
			} else {
				result = await submit(formData);
			}
			cmdMessage = result?.message ?? null;
			cmdWarnings = result?.warnings ?? [];
			await invalidateAll();
		} catch (err) {
			cmdError = err instanceof Error ? err.message : '失敗';
		}
	}
</script>

<svelte:head>
	<title>{data.team.name} オーダー入力 | 東大リーグ団体戦</title>
</svelte:head>

<div class="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-950 sm:px-6">
	<div class="space-y-6">
		<!-- Header -->
		<header>
			<a
				class="text-sm text-zinc-500 hover:text-zinc-700"
				href={resolve('/ties/[tieId]', { tieId: data.tie.id })}
			>
				← {data.tie.tieCode}
			</a>
			<div class="mt-2 flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 class="text-2xl font-semibold tracking-tight">{data.team.name}</h1>
					<p class="mt-0.5 text-sm text-zinc-500">オーダー入力</p>
				</div>
				<span class="rounded-full px-3 py-1 text-sm font-medium {statusBadgeClass(status)}">
					{submissionStatusLabel(status)}
				</span>
			</div>
		</header>

		<!-- Form feedback -->
		{#if cmdMessage}
			<div
				class="rounded-xl border px-4 py-3 text-sm {cmdWarnings.length
					? 'border-amber-200 bg-amber-50 text-amber-800'
					: 'border-emerald-200 bg-emerald-50 text-emerald-800'}"
			>
				<p class="font-medium">{cmdMessage}</p>
				{#if cmdWarnings.length}
					<ul class="mt-1.5 list-disc space-y-0.5 pl-5 text-amber-700">
						{#each cmdWarnings as w (w)}<li>{w}</li>{/each}
					</ul>
				{/if}
			</div>
		{/if}
		{#if cmdError}
			<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
				{cmdError}
			</div>
		{/if}

		<!-- Locked/revealed: read-only display -->
		{#if isLocked}
			<section class="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
				<div class="border-b border-zinc-100 px-5 py-4">
					<p class="text-sm text-zinc-500">
						{status === 'revealed'
							? 'オーダーが公開されました。'
							: 'オーダーは承認済みです。変更する場合は運営にお問い合わせください。'}
					</p>
				</div>
				<div class="divide-y divide-zinc-100">
					{#each RUBBER_DEFINITIONS as rubber (rubber.code)}
						{@const item = data.items.find((i: Item) => i.rubberCode === rubber.code)}
						<div class="grid grid-cols-[8rem_1fr] gap-3 px-5 py-3.5">
							<p class="pt-0.5 text-xs font-medium text-zinc-500">{rubberLabel(rubber.code)}</p>
							<div class="space-y-0.5">
								{#if item?.player1Id}
									<p class="text-sm">{playerName(item.player1Id)}</p>
								{:else}
									<p class="text-sm text-zinc-400">未入力</p>
								{/if}
								{#if item?.player2Id}
									<p class="text-sm">{playerName(item.player2Id)}</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</section>
		{:else}
			{#if isSubmitted}
				<div class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
					提出済みです。変更する場合はそのまま編集して再提出してください。
				</div>
			{/if}

			{#if data.players.length === 0}
				<div class="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
					<p class="text-sm text-zinc-400">選手が登録されていません</p>
				</div>
			{:else}
				<section class="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
					<form onsubmit={handleLineup} class="divide-y divide-zinc-100">
						{#each RUBBER_DEFINITIONS as rubber (rubber.code)}
							<div class="px-5 py-4">
								<p class="mb-2.5 text-xs font-medium text-zinc-500">{rubberLabel(rubber.code)}</p>
								<div class="grid grid-cols-2 gap-2">
									{#each [1, 2] as order (order)}
										{@const slotPlayers = filteredPlayers(rubber.discipline, order as 1 | 2)}
										{@const playerItems = [
											{ value: '', label: '未入力' },
											...slotPlayers.map((p) => ({ value: p.id, label: p.name }))
										]}
										<div>
											<span class="mb-1 block text-xs text-zinc-400">
												{slotLabel(rubber.discipline, order as 1 | 2)}
											</span>
											<AppSelect
												name="{rubber.code}_{order}"
												value={savedValue(rubber.code, order as 1 | 2)}
												items={playerItems}
												placeholder="未入力"
											/>
										</div>
									{/each}
								</div>
							</div>
						{/each}

						<div class="flex justify-end gap-2 px-5 py-4">
							<button
								type="submit"
								formnovalidate
								onclick={() => (lineupAction = 'draft')}
								class="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
							>
								下書き保存
							</button>
							<button
								type="submit"
								onclick={() => (lineupAction = 'submit')}
								class="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
							>
								提出する
							</button>
						</div>
					</form>
				</section>
			{/if}
		{/if}
	</div>
</div>
