<script lang="ts">
	import { resolve } from '$app/paths';
	import { ChevronRight } from '@lucide/svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let groups = $derived([
		{ code: 'A', label: 'Aリーグ', teams: data.teamsA, ties: data.tiesA },
		{ code: 'B', label: 'Bリーグ', teams: data.teamsB, ties: data.tiesB }
	]);
</script>

<svelte:head>
	<title>予選リーグ | 東大リーグ団体戦</title>
</svelte:head>

<PageHeader title="予選リーグ" />

<div class="grid gap-4 sm:grid-cols-2">
	{#each groups as group (group.code)}
		<a
			class="group block rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-colors hover:border-zinc-400"
			href={resolve('/groups/[groupCode]', { groupCode: group.code })}
		>
			<div class="flex items-start">
				<h2 class="text-xl font-semibold">{group.label}</h2>
			</div>

			<div class="mt-5 grid grid-cols-2 gap-3">
				<div class="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
					<p class="text-xs font-medium text-zinc-500">チーム</p>
					<p class="mt-0.5 text-2xl font-semibold tabular-nums">{group.teams.length}</p>
				</div>
				<div class="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
					<p class="text-xs font-medium text-zinc-500">対戦数</p>
					<p class="mt-0.5 text-2xl font-semibold tabular-nums">{group.ties.length}</p>
				</div>
			</div>

			<p
				class="mt-4 flex items-center gap-1 text-sm font-medium text-zinc-500 group-hover:text-zinc-700"
			>
				詳細を開く
				<ChevronRight class="size-4 transition-transform group-hover:translate-x-0.5" />
			</p>
		</a>
	{/each}
</div>
