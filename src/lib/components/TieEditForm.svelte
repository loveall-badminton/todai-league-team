<script lang="ts">
	import type { Snippet } from 'svelte';
	import AppInput from '$lib/components/ui/AppInput.svelte';
	import AppCheckbox from '$lib/components/ui/AppCheckbox.svelte';
	import AppMultipleSelect from '$lib/components/ui/AppMultipleSelect.svelte';
	import CourtPicker from '$lib/components/CourtPicker.svelte';
	import FormToast from '$lib/components/ui/FormToast.svelte';
	import type { EntityOption } from '$lib/types/entities';
	import { updateTie } from '../../routes/_shared/tieEditForm.remote';

	type TieFields = {
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
		teams = [],
		id,
		onSaved,
		children
	}: {
		tie: TieFields;
		teams?: EntityOption[];
		id: string;
		onSaved?: () => void;
		children?: Snippet;
	} = $props();

	let teamItems = $derived(
		Array.from(
			new Map(teams.map((team) => [team.id, { value: team.id, label: team.name }])).values()
		)
	);
	let assignedTeamIds = $derived(
		Array.from(
			new Set(tie.officiatingTeamIds ?? (tie.officiatingTeamId ? [tie.officiatingTeamId] : []))
		)
	);

	let formId = $props.id();
	let updateTieInstance = $derived(updateTie.for(formId));
</script>

<form
	{...updateTieInstance.enhance(async (form) => {
		if (await form.submit()) {
			onSaved?.();
		}
	})}
	class="space-y-4"
>
	<FormToast result={updateTieInstance.result} />
	<input type="hidden" name="id" value={id} />

	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
		<label class="grid gap-1">
			<span class="text-xs font-medium text-zinc-500">予定時刻</span>
			<AppInput
				{...updateTieInstance.fields.scheduledStartAt.as('time', tie.scheduledStartAt ?? '')}
			/>
		</label>
		<label class="grid gap-1">
			<span class="text-xs font-medium text-zinc-500">オーダー期限</span>
			<AppInput {...updateTieInstance.fields.lineupDueAt.as('time', tie.lineupDueAt ?? '')} />
		</label>
		{#if teams.length > 0}
			<label class="grid gap-1">
				<span class="text-xs font-medium text-zinc-500">審判担当</span>
				<AppMultipleSelect
					name="assignedTeamIds"
					value={assignedTeamIds}
					items={teamItems}
					placeholder="未割当"
				/>
			</label>
		{/if}
	</div>

	<label class="grid gap-1">
		<span class="text-xs font-medium text-zinc-500">体育館・コート</span>
		<CourtPicker initialVenue={tie.venue} initialCourts={tie.courtBlockCode} />
	</label>

	<div class="grid gap-3 sm:grid-cols-2">
		<label class="grid gap-1">
			<span class="text-xs font-medium text-zinc-500">運営メモ</span>
			<AppInput {...updateTieInstance.fields.operationNote.as('text', tie.operationNote ?? '')} />
		</label>
		{#if teams.length > 0}
			<label class="grid gap-1">
				<span class="text-xs font-medium text-zinc-500">審判メモ</span>
				<AppInput
					{...updateTieInstance.fields.officiatingNote.as('text', tie.officiatingNote ?? '')}
				/>
			</label>
		{/if}
	</div>

	<AppCheckbox name="scheduleChanged" checked={tie.scheduleChanged} label="変更あり" />

	{#if children}
		{@render children()}
	{/if}
</form>
