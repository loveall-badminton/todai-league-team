<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight, GripVertical } from '@lucide/svelte';
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
		class="flex w-6 shrink-0 cursor-grab items-center py-3.5 text-zinc-300 hover:text-muted-foreground"
	>
		<GripVertical class="h-4 w-4" />
	</div>

	<!-- Clickable content -->
	<a
		href={resolve('/teams/[teamId]', { teamId: team.id })}
		class="flex min-w-0 flex-1 items-center gap-3 py-3.5 lg:contents"
	>
		<!-- Name + shortName -->
		<div class="min-w-0 flex-1 lg:flex-none">
			<p class="truncate text-sm font-semibold text-default">{team.name}</p>
			{#if team.shortName}
				<p class="text-xs text-muted">{team.shortName}</p>
			{/if}
		</div>

		<!-- League badge -->
		<div class="flex w-16 justify-center">
			<GroupBadge groupCode={team.groupCode} />
		</div>

		<!-- Player count -->
		<div class="hidden w-20 text-right lg:block">
			<span class="text-sm text-zinc-700">{team.playerCount}名</span>
		</div>

		<!-- Status -->
		<div class="flex w-16 justify-center">
			{#if team.status === 'withdrawn'}
				<span
					class="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
					>棄権</span
				>
			{:else}
				<span
					class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
					>出場</span
				>
			{/if}
		</div>

		<!-- Arrow -->
		<div class="hidden w-12 text-right lg:block">
			<span class="text-zinc-300"><ArrowRight class="size-3" /></span>
		</div>

		<!-- Mobile: player count -->
		<div class="ml-auto text-right lg:hidden">
			<span class="text-xs text-muted">{team.playerCount}名</span>
		</div>
	</a>
</div>
