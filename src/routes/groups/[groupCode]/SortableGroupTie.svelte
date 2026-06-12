<script lang="ts">
	import { resolve } from '$app/paths';
	import { GripVertical, ChevronDown } from '@lucide/svelte';
	import { createSortable } from '@dnd-kit/svelte/sortable';
	import { Collapsible } from 'bits-ui';
	import { courtDisplayLabel } from '$lib/domain/tokyoLeagueLabels';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import AppCheckbox from '$lib/components/AppCheckbox.svelte';
	import CourtPicker from '$lib/components/CourtPicker.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';

	type TieRow = {
		id: string;
		tieCode: string;
		teamAName: string | null;
		teamBName: string | null;
		venue: string | null;
		courtBlockCode: string | null;
		scheduledStartAt: string | null;
		lineupDueAt: string | null;
		operationNote: string | null;
		officiatingNote: string | null;
		officiatingTeamId: string | null;
		scheduleChanged: boolean;
		status: string;
		rubberCount: number;
	};

	type Team = { id: string; name: string };

	let { tie, index, allTeams }: { tie: TieRow; index: number; allTeams: Team[] } = $props();

	const sortable = createSortable({
		get id() { return tie.id; },
		get index() { return index; }
	});

	const teamItems = $derived([
		{ value: '', label: '未割当' },
		...allTeams.map((t) => ({ value: t.id, label: t.name }))
	]);

	let assignedTeamId = $state(tie.officiatingTeamId ?? '');
</script>

<div
	{@attach sortable.attach}
	class="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden
		{sortable.isDragging ? 'opacity-40' : ''}"
>
	<Collapsible.Root>
		<div class="flex items-stretch">
			<div
				{@attach sortable.attachHandle}
				class="cursor-grab px-3 flex items-center text-zinc-300 hover:text-zinc-500 border-r border-zinc-100 shrink-0"
			>
				<GripVertical class="h-4 w-4" />
			</div>

			<Collapsible.Trigger class="group/tie flex flex-1 items-start justify-between gap-4 px-4 py-4 text-left">
				<div class="flex min-w-0 flex-col gap-1">
					<div class="flex flex-wrap items-center gap-2">
						<span class="font-semibold">{tie.tieCode}</span>
						<StatusBadge status={tie.status} />
						{#if tie.scheduleChanged}
							<span class="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">変更あり</span>
						{/if}
					</div>
					<p class="text-sm text-zinc-500">{tie.teamAName ?? '未定'} vs {tie.teamBName ?? '未定'}</p>
					<p class="text-xs text-zinc-400">
						{courtDisplayLabel(tie.venue, tie.courtBlockCode)}
						{#if tie.scheduledStartAt}/ {tie.scheduledStartAt}{/if}
					</p>
				</div>
				<div class="flex shrink-0 items-center gap-2">
					<span class="rounded-lg bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
						{tie.rubberCount}/5
					</span>
					<a
						class="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
						href={resolve('/ties/[tieId]', { tieId: tie.id })}
						onclick={(e) => e.stopPropagation()}
					>
						詳細
					</a>
					<ChevronDown class="size-4 text-zinc-400 transition-transform group-data-[state=open]/tie:rotate-180" />
				</div>
			</Collapsible.Trigger>
		</div>

		<Collapsible.Content>
			<div class="border-t border-zinc-100 px-5 py-4">
				<form method="POST" action="?/updateTie" class="space-y-4">
					<input type="hidden" name="id" value={tie.id} />

					<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						<div class="grid gap-1">
							<span class="text-xs font-medium text-zinc-500">コード</span>
							<AppInput name="tieCode" value={tie.tieCode} required />
						</div>
						<div class="grid gap-1">
							<span class="text-xs font-medium text-zinc-500">予定時刻</span>
							<AppInput name="scheduledStartAt" type="datetime-local" value={tie.scheduledStartAt ?? ''} />
						</div>
						<div class="grid gap-1">
							<span class="text-xs font-medium text-zinc-500">オーダー期限</span>
							<AppInput name="lineupDueAt" type="datetime-local" value={tie.lineupDueAt ?? ''} />
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

					<div class="flex items-center gap-4">
						<button
							class="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
						>
							保存
						</button>
						<AppCheckbox name="scheduleChanged" checked={tie.scheduleChanged} label="変更あり" />
					</div>
				</form>
			</div>
		</Collapsible.Content>
	</Collapsible.Root>
</div>
