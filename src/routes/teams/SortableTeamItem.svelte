<script lang="ts">
	import { resolve } from '$app/paths';
	import { GripVertical } from '@lucide/svelte';
	import { createSortable } from '@dnd-kit/svelte/sortable';
	import GroupBadge from '$lib/components/GroupBadge.svelte';
	import type { TeamSummary } from '$lib/server/repositories/tokyoLeagueRepository';

	let { team, index }: { team: TeamSummary; index: number } = $props();

	const sortable = createSortable({
		get id() {
			return team.id;
		},
		get index() {
			return index;
		}
	});
</script>

<div
	{@attach sortable.attach}
	class="flex items-center gap-2 px-4 transition-colors lg:grid lg:grid-cols-[auto_1fr_auto_auto_auto_auto]
		{sortable.isDragging ? 'opacity-40' : 'hover:bg-zinc-50'}"
>
	<!-- Drag handle -->
	<div
		{@attach sortable.attachHandle}
		class="cursor-grab py-3.5 flex-shrink-0 w-6 flex items-center text-zinc-300 hover:text-zinc-500"
	>
		<GripVertical class="h-4 w-4" />
	</div>

	<!-- Clickable content -->
	<a
		href={resolve('/teams/[teamId]', { teamId: team.id })}
		class="flex flex-1 items-center gap-3 py-3.5 min-w-0 lg:contents"
	>
		<!-- Name + shortName -->
		<div class="min-w-0 flex-1 lg:flex-none">
			<p class="font-semibold text-zinc-950 text-sm truncate">{team.name}</p>
			{#if team.shortName}
				<p class="text-xs text-zinc-400">{team.shortName}</p>
			{/if}
		</div>

		<!-- League badge -->
		<div class="w-16 flex justify-center">
			<GroupBadge groupCode={team.groupCode} />
		</div>

		<!-- Player count -->
		<div class="w-20 text-right hidden lg:block">
			<span class="text-sm text-zinc-700">{team.playerCount}名</span>
		</div>

		<!-- Status -->
		<div class="w-16 flex justify-center">
			{#if team.status === 'withdrawn'}
				<span
					class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700"
					>棄権</span
				>
			{:else}
				<span
					class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700"
					>出場</span
				>
			{/if}
		</div>

		<!-- Arrow -->
		<div class="w-12 text-right hidden lg:block">
			<span class="text-zinc-300">→</span>
		</div>

		<!-- Mobile: player count -->
		<div class="ml-auto text-right lg:hidden">
			<span class="text-xs text-zinc-400">{team.playerCount}名</span>
		</div>
	</a>
</div>
