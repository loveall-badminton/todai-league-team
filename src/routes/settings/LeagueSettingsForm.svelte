<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import FormToast from '$lib/components/FormToast.svelte';
	import type { FormInstance } from '$lib/types/forms';
	import { updateSettingsSchema } from './settings.schema';
	import type { SelectItem } from '$lib/types/ui';

	let {
		form,
		settings,
		scoringRuleItems,
		lineupRevealItems
	}: {
		form: FormInstance<typeof updateSettingsSchema>;
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

	$effect(() => {
		form.fields.set({
			eventName: settings.eventName ?? '',
			groupStageScoringRuleId: settings.groupStageScoringRuleId ?? '',
			knockoutScoringRuleId: settings.knockoutScoringRuleId ?? '',
			tiebreakerScoringRuleId: settings.tiebreakerScoringRuleId ?? '',
			lineupRevealPolicy: (settings.lineupRevealPolicy ?? 'on_tie_start') as
				| 'on_tie_start'
				| 'manual',
			defaultLineupDueMinutesBefore: String(settings.defaultLineupDueMinutesBefore)
		});
	});
</script>

<form {...form} class="space-y-4">
	<FormToast result={form.result} />
	<div class="grid gap-1">
		<span class="text-sm font-medium text-zinc-700">大会名</span>
		<AppInput {...form.fields.eventName.as('text')} required />
		{#each form.fields.eventName.issues() ?? [] as issue (issue.message)}
			<span class="text-xs text-red-600">{issue.message}</span>
		{/each}
	</div>

	<div class="grid gap-4 sm:grid-cols-3">
		<div class="grid gap-1">
			<span class="text-sm font-medium text-zinc-700">予選ルール</span>
			<AppSelect {...form.fields.groupStageScoringRuleId.as('select')} items={scoringRuleItems} />
		</div>
		<div class="grid gap-1">
			<span class="text-sm font-medium text-zinc-700">決勝トーナメントルール</span>
			<AppSelect {...form.fields.knockoutScoringRuleId.as('select')} items={scoringRuleItems} />
		</div>
		<div class="grid gap-1">
			<span class="text-sm font-medium text-zinc-700">順位決定再試合</span>
			<AppSelect {...form.fields.tiebreakerScoringRuleId.as('select')} items={scoringRuleItems} />
		</div>
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
		<div class="grid gap-1">
			<span class="text-sm font-medium text-zinc-700">オーダー公開</span>
			<AppSelect {...form.fields.lineupRevealPolicy.as('select')} items={lineupRevealItems} />
		</div>
		<div class="grid gap-1">
			<span class="text-sm font-medium text-zinc-700">提出期限 (開始前の分数)</span>
			<AppInput type="number" {...form.fields.defaultLineupDueMinutesBefore.as('text')} min="0" />
		</div>
	</div>

	<div class="flex justify-end border-t border-zinc-100 pt-4">
		<AppButton type="submit">保存</AppButton>
	</div>
</form>
