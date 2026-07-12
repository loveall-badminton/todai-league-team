<script lang="ts">
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import AppInput from '$lib/components/ui/AppInput.svelte';
	import AppSelect from '$lib/components/ui/AppSelect.svelte';
	import FormToast from '$lib/components/ui/FormToast.svelte';
	import { updateTeam } from './team.remote';

	let {
		team
	}: {
		team: { name: string; shortName: string | null; groupCode: string | null; status: string };
	} = $props();

	const groupCodeItems = [
		{ value: '', label: '未割当' },
		{ value: 'A', label: 'Aリーグ' },
		{ value: 'B', label: 'Bリーグ' }
	];
	const statusItems = [
		{ value: 'active', label: '出場' },
		{ value: 'withdrawn', label: '棄権' }
	];
</script>

<form {...updateTeam} class="space-y-4">
	<FormToast result={updateTeam.result} />
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		<div class="lg:col-span-1">
			<label class="block">
				<span class="text-xs font-medium tracking-wide text-muted-foreground">チーム名 *</span>
				<AppInput {...updateTeam.fields.name.as('text', team.name)} required class="mt-1" />
			</label>
		</div>
		<div>
			<label class="block">
				<span class="text-xs font-medium tracking-wide text-muted-foreground">略称</span>
				<AppInput {...updateTeam.fields.shortName.as('text', team.shortName ?? '')} class="mt-1" />
			</label>
		</div>
		<div>
			<label class="block">
				<span class="text-xs font-medium tracking-wide text-muted-foreground">リーグ</span>
				<AppSelect
					{...updateTeam.fields.groupCode.as('select', team.groupCode ?? '')}
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
				<span class="text-xs font-medium tracking-wide text-muted-foreground">状態</span>
				<AppSelect
					{...updateTeam.fields.status.as('select', team.status)}
					items={statusItems}
					class="mt-1"
				/>
			</label>
		</div>
		<div class="flex items-end">
			<AppButton type="submit">保存</AppButton>
		</div>
	</div>
</form>
