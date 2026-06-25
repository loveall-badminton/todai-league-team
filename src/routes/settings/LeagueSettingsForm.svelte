<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import FormToast from '$lib/components/FormToast.svelte';
	import type { SelectItem } from '$lib/types/ui';
	import { updateSettings } from './settings.remote';

	let {
		settings,
		scoringRuleItems,
		lineupRevealItems
	}: {
		settings: {
			eventName: string | null;
			groupStageScoringRuleId: string | null;
			knockoutScoringRuleId: string | null;
			tiebreakerScoringRuleId: string | null;
			lineupRevealPolicy: string;
			defaultLineupDueMinutesBefore: number;
		};
		scoringRuleItems: SelectItem[];
		lineupRevealItems: SelectItem[];
	} = $props();
</script>

<form {...updateSettings} class="space-y-4">
	<FormToast result={updateSettings.result} />
	<div class="grid gap-1">
		<span class="text-sm font-medium text-zinc-700">大会名</span>
		<AppInput {...updateSettings.fields.eventName.as('text', settings.eventName ?? '')} required />
		{#each updateSettings.fields.eventName.issues() ?? [] as issue (issue.message)}
			<span class="text-xs text-red-600">{issue.message}</span>
		{/each}
	</div>

	<div class="grid gap-4 sm:grid-cols-3">
		<div class="grid gap-1">
			<span class="text-sm font-medium text-zinc-700">予選ルール</span>
			<AppSelect
				{...updateSettings.fields.groupStageScoringRuleId.as(
					'select',
					settings.groupStageScoringRuleId ?? ''
				)}
				items={scoringRuleItems}
			/>
		</div>
		<div class="grid gap-1">
			<span class="text-sm font-medium text-zinc-700">決勝トーナメントルール</span>
			<AppSelect
				{...updateSettings.fields.knockoutScoringRuleId.as(
					'select',
					settings.knockoutScoringRuleId ?? ''
				)}
				items={scoringRuleItems}
			/>
		</div>
		<div class="grid gap-1">
			<span class="text-sm font-medium text-zinc-700">順位決定再試合</span>
			<AppSelect
				{...updateSettings.fields.tiebreakerScoringRuleId.as(
					'select',
					settings.tiebreakerScoringRuleId ?? ''
				)}
				items={scoringRuleItems}
			/>
		</div>
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
		<div class="grid gap-1">
			<span class="text-sm font-medium text-zinc-700">オーダー公開</span>
			<AppSelect
				{...updateSettings.fields.lineupRevealPolicy.as(
					'select',
					settings.lineupRevealPolicy ?? 'on_tie_start'
				)}
				items={lineupRevealItems}
			/>
		</div>
		<div class="grid gap-1">
			<span class="text-sm font-medium text-zinc-700">提出期限 (開始前の分数)</span>
			<AppInput
				type="number"
				{...updateSettings.fields.defaultLineupDueMinutesBefore.as(
					'text',
					String(settings.defaultLineupDueMinutesBefore)
				)}
				min="0"
			/>
		</div>
	</div>

	<div class="flex justify-end border-t border-border-subtle pt-4">
		<AppButton type="submit">保存</AppButton>
	</div>
</form>
