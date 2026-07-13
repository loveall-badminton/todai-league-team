<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight, Award, ChevronDown, GripVertical } from '@lucide/svelte';
	import { createSortable } from '@dnd-kit/svelte/sortable';
	import { courtDisplayLabel, phaseLabel } from '$lib/domain/tokyoLeagueLabels';
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import IconMeta from '$lib/components/ui/IconMeta.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import type { TieSummary } from '$lib/server/repositories/tokyoLeagueRepository';
	import TieEditForm from '$lib/components/TieEditForm.svelte';
	import type { EntityOption } from '$lib/types/entities';
	import { cn } from '$lib/utils/cn';

	let {
		tie,
		index,
		sortable: sortableEnabled = true,
		teams = []
	}: {
		tie: TieSummary;
		index: number;
		sortable?: boolean;
		teams?: EntityOption[];
	} = $props();

	let open = $state(false);

	const sortable = createSortable({
		get id() {
			return tie.id;
		},
		get index() {
			return index;
		},
		get disabled() {
			return !sortableEnabled;
		}
	});
</script>

<div
	{@attach sortable.attach}
	class={cn(
		'overflow-hidden rounded-xl border border-zinc-200 bg-white',
		sortable.isDragging && 'opacity-40'
	)}
>
	<div>
		<div class="flex items-stretch">
			{#if sortableEnabled}
				<div
					{@attach sortable.attachHandle}
					class="flex shrink-0 cursor-grab items-center border-r border-zinc-100 px-3 text-zinc-300 hover:text-zinc-500"
				>
					<GripVertical class="h-4 w-4" />
				</div>
			{/if}

			<button
				type="button"
				aria-expanded={open}
				onclick={() => (open = !open)}
				class="group/tie flex flex-1 items-center justify-between gap-3 px-4 py-3 text-left"
			>
				<div class="flex min-w-0 flex-col gap-0.5">
					<div class="flex flex-wrap items-center gap-2">
						<span class="font-semibold text-zinc-950">{tie.tieCode}</span>
						<StatusBadge status={tie.status} />
						{#if tie.scheduleChanged}
							<span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
								>変更</span
							>
						{/if}
					</div>
					<p class="truncate text-sm text-zinc-600">
						{tie.teamAName ?? '未定'} <span class="text-zinc-400">vs</span>
						{tie.teamBName ?? '未定'}
					</p>
					<p class="text-xs text-zinc-400">
						{phaseLabel(tie.phase)}
						{#if tie.scheduledStartAt}· {tie.scheduledStartAt}{/if}
						{#if tie.venue || tie.courtBlockCode}· {courtDisplayLabel(
								tie.venue,
								tie.courtBlockCode
							)}{/if}
					</p>
				</div>
				<div class="flex shrink-0 items-center gap-2">
					{#if tie.status === 'playing' || tie.status === 'finished' || tie.status === 'confirmed'}
						<div class="flex flex-col items-end">
							<span
								class={cn(
									'text-sm font-bold tabular-nums',
									tie.status === 'playing' ? 'text-emerald-700' : 'text-zinc-700'
								)}
							>
								{tie.teamScoreA}–{tie.teamScoreB}
							</span>
							{#if tie.winnerTeamId}
								<IconMeta
									Icon={Award}
									label="勝者"
									value={(tie.winnerTeamId === tie.teamAId ? tie.teamAName : tie.teamBName) ??
										'未定'}
									class="text-[10px] font-medium text-emerald-700"
									iconClass="size-3 shrink-0"
								/>
							{/if}
						</div>
					{/if}
					<ChevronDown
						class={cn('size-4 text-zinc-400 transition-transform', open && 'rotate-180')}
					/>
				</div>
			</button>
			<a
				href={resolve('/ties/[tieId]', { tieId: tie.id })}
				data-sveltekit-preload-data="tap"
				class="hidden shrink-0 items-center border-l border-zinc-100 px-4 text-xs font-medium text-zinc-600 hover:bg-zinc-50 sm:flex"
			>
				詳細 <ArrowRight class="inline size-3" />
			</a>
		</div>

		{#if open}
			<div class="border-t border-zinc-100 px-5 py-4">
				<TieEditForm {tie} {teams} id={tie.id}>
					<div class="flex items-center justify-between">
						<AppButton variant="primary">保存</AppButton>
						<a
							href={resolve('/ties/[tieId]', { tieId: tie.id })}
							data-sveltekit-preload-data="tap"
							class="text-xs text-zinc-400 hover:text-zinc-700 hover:underline"
						>
							詳細を開く <ArrowRight class="inline size-3" />
						</a>
					</div>
				</TieEditForm>
			</div>
		{/if}
	</div>
</div>
