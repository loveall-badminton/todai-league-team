<script lang="ts">
	import { resolve } from '$app/paths';
	import { GripVertical, ChevronDown } from '@lucide/svelte';
	import { createSortable } from '@dnd-kit/svelte/sortable';
	import { Collapsible } from 'bits-ui';
	import { courtDisplayLabel, phaseLabel } from '$lib/domain/tokyoLeagueLabels';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import AppCheckbox from '$lib/components/AppCheckbox.svelte';
	import CourtPicker from '$lib/components/CourtPicker.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import type { TieSummary } from '$lib/server/repositories/tokyoLeagueRepository';

	type Team = { id: string; name: string };

	let {
		tie,
		index,
		sortable: sortableEnabled = true,
		teams = [] as Team[],
		tieForm
	}: {
		tie: TieSummary;
		index: number;
		sortable?: boolean;
		teams?: Team[];
		tieForm: Record<string, unknown>;
	} = $props();

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

	let teamItems = $derived([
		{ value: '', label: '未割当' },
		...teams.map((t) => ({ value: t.id, label: t.name }))
	]);

	let assignedTeamId = $derived(tie.officiatingTeamId ?? '');
</script>

<div
	{@attach sortable.attach}
	class="overflow-hidden rounded-xl border border-zinc-200 bg-white
		{sortable.isDragging ? 'opacity-40' : ''}"
>
	<Collapsible.Root>
		<div class="flex items-stretch">
			{#if sortableEnabled}
				<div
					{@attach sortable.attachHandle}
					class="flex shrink-0 cursor-grab items-center border-r border-zinc-100 px-3 text-zinc-300 hover:text-zinc-500"
				>
					<GripVertical class="h-4 w-4" />
				</div>
			{/if}

			<Collapsible.Trigger
				class="group/tie flex flex-1 items-center justify-between gap-3 px-4 py-3 text-left"
			>
				<div class="flex min-w-0 flex-col gap-0.5">
					<div class="flex flex-wrap items-center gap-2">
						<span class="font-semibold text-zinc-900">{tie.tieCode}</span>
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
						<div class="text-center">
							<span
								class="text-sm font-bold tabular-nums {tie.status === 'playing'
									? 'text-emerald-700'
									: 'text-zinc-700'}"
							>
								{tie.teamScoreA}–{tie.teamScoreB}
							</span>
							<p class="text-[10px] text-zinc-400">種目</p>
						</div>
					{/if}
					<a
						href={resolve('/ties/[tieId]', { tieId: tie.id })}
						onclick={(e) => e.stopPropagation()}
						class="hidden rounded-lg border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 sm:block"
					>
						詳細 →
					</a>
					<ChevronDown
						class="size-4 text-zinc-400 transition-transform group-data-[state=open]/tie:rotate-180"
					/>
				</div>
			</Collapsible.Trigger>
		</div>

		<Collapsible.Content>
			<div class="border-t border-zinc-100 px-5 py-4">
				<form {...tieForm} class="space-y-4">
					<input type="hidden" name="id" value={tie.id} />

					<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<div class="grid gap-1">
							<span class="text-xs font-medium text-zinc-500">コード</span>
							<AppInput name="tieCode" value={tie.tieCode} required />
						</div>
						<div class="grid gap-1">
							<span class="text-xs font-medium text-zinc-500">予定時刻</span>
							<AppInput name="scheduledStartAt" type="time" value={tie.scheduledStartAt ?? ''} />
						</div>
						<div class="grid gap-1">
							<span class="text-xs font-medium text-zinc-500">オーダー期限</span>
							<AppInput name="lineupDueAt" type="time" value={tie.lineupDueAt ?? ''} />
						</div>
						<div class="grid gap-1">
							<span class="text-xs font-medium text-zinc-500">審判担当</span>
							<AppSelect name="assignedTeamId" bind:value={assignedTeamId} items={teamItems} />
						</div>
					</div>

					<div class="grid gap-1">
						<span class="text-xs font-medium text-zinc-500">体育館・コート</span>
						<CourtPicker initialVenue={tie.venue} initialCourts={tie.courtBlockCode} />
					</div>

					<div class="grid gap-3 sm:grid-cols-2">
						<div class="grid gap-1">
							<span class="text-xs font-medium text-zinc-500">運営メモ</span>
							<AppInput name="operationNote" value={tie.operationNote ?? ''} />
						</div>
						<div class="grid gap-1">
							<span class="text-xs font-medium text-zinc-500">審判メモ</span>
							<AppInput name="officiatingNote" value={tie.officiatingNote ?? ''} />
						</div>
					</div>

					<div class="flex items-center justify-between">
						<div class="flex items-center gap-4">
							<button
								class="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
							>
								保存
							</button>
							<AppCheckbox name="scheduleChanged" checked={tie.scheduleChanged} label="変更あり" />
						</div>
						<a
							href={resolve('/ties/[tieId]', { tieId: tie.id })}
							class="text-xs text-zinc-400 hover:text-zinc-700 hover:underline"
						>
							詳細を開く →
						</a>
					</div>
				</form>
			</div>
		</Collapsible.Content>
	</Collapsible.Root>
</div>
