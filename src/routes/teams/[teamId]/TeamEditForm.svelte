<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import FormToast from '$lib/components/FormToast.svelte';
	import { updateTeam } from './team.remote';
	import type { SelectItem } from '$lib/types/ui';

	let {
		team,
		groupCodeItems,
		statusItems
	}: {
		team: { name: string; shortName: string | null; groupCode: string | null; status: string };
		groupCodeItems: SelectItem[];
		statusItems: SelectItem[];
	} = $props();

	$effect(() => {
		updateTeam.fields.set({
			name: team.name,
			shortName: team.shortName ?? '',
			groupCode: (team.groupCode ?? '') as '' | 'A' | 'B',
			status: team.status as 'active' | 'withdrawn'
		});
	});
</script>

<form {...updateTeam} class="space-y-4">
	<FormToast result={updateTeam.result} />
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		<div class="lg:col-span-1">
			<label class="block">
				<span class="text-xs font-medium tracking-wide text-zinc-500">チーム名 *</span>
				<AppInput {...updateTeam.fields.name.as('text')} required class="mt-1" />
			</label>
		</div>
		<div>
			<label class="block">
				<span class="text-xs font-medium tracking-wide text-zinc-500">略称</span>
				<AppInput {...updateTeam.fields.shortName.as('text')} class="mt-1" />
			</label>
		</div>
		<div>
			<label class="block">
				<span class="text-xs font-medium tracking-wide text-zinc-500">リーグ</span>
				<AppSelect
					{...updateTeam.fields.groupCode.as('select')}
					items={groupCodeItems}
					placeholder="未割当"
					class="mt-1"
				/>
			</label>
		</div>
	</div>
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		<div>
			<label class="block">
				<span class="text-xs font-medium tracking-wide text-zinc-500">状態</span>
				<AppSelect {...updateTeam.fields.status.as('select')} items={statusItems} class="mt-1" />
			</label>
		</div>
		<div class="flex items-end">
			<AppButton type="submit">保存</AppButton>
		</div>
	</div>
</form>
