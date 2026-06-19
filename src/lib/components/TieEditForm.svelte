<script lang="ts">
	import AppInput from '$lib/components/AppInput.svelte';
	import AppCheckbox from '$lib/components/AppCheckbox.svelte';
	import AppMultipleSelect from '$lib/components/AppMultipleSelect.svelte';
	import CourtPicker from '$lib/components/CourtPicker.svelte';

	import type { EntityOption } from '$lib/types/entities';

	type TieFields = {
		tieCode: string;
		scheduledStartAt?: string | null;
		lineupDueAt?: string | null;
		venue?: string | null;
		courtBlockCode?: string | null;
		operationNote?: string | null;
		officiatingNote?: string | null;
		scheduleChanged: boolean;
		officiatingTeamId?: string | null;
		officiatingTeamIds?: string[] | null;
	};

	let {
		tie,
		teams = [] as EntityOption[]
	}: {
		tie: TieFields;
		teams?: EntityOption[];
	} = $props();

	let assignedTeamIds = $derived(
		tie.officiatingTeamIds ?? (tie.officiatingTeamId ? [tie.officiatingTeamId] : [])
	);
	let teamItems = $derived(teams.map((team) => ({ value: team.id, label: team.name })));
</script>

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
	{#if teams.length > 0}
		<div class="grid gap-1">
			<span class="text-xs font-medium text-zinc-500">審判担当</span>
			<AppMultipleSelect
				name="assignedTeamIds"
				value={assignedTeamIds}
				items={teamItems}
				placeholder="未割当"
			/>
		</div>
	{/if}
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
	{#if teams.length > 0}
		<div class="grid gap-1">
			<span class="text-xs font-medium text-zinc-500">審判メモ</span>
			<AppInput name="officiatingNote" value={tie.officiatingNote ?? ''} />
		</div>
	{/if}
</div>

<AppCheckbox name="scheduleChanged" checked={tie.scheduleChanged} label="変更あり" />
