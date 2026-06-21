<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import FormToast from '$lib/components/FormToast.svelte';
	import { updateScoringRule } from './settings.remote';

	type Rule = {
		id: string;
		code: string;
		name: string;
		maxGames: number;
		gamesToWin: number;
		pointsToWin: number;
		winBy: number;
		maxPoints: number;
		midGameIntervalPoint: number;
	};

	let { rule }: { rule: Rule } = $props();

	const ruleForm = $derived(updateScoringRule.for(rule.id));

	$effect(() => {
		ruleForm.fields.set({
			id: rule.id,
			name: rule.name,
			maxGames: String(rule.maxGames),
			gamesToWin: String(rule.gamesToWin),
			pointsToWin: String(rule.pointsToWin),
			winBy: String(rule.winBy),
			maxPoints: String(rule.maxPoints),
			midGameIntervalPoint: String(rule.midGameIntervalPoint)
		});
	});
</script>

<form {...ruleForm}>
	<input {...ruleForm.fields.id.as('hidden', '')} />

	<div class="mb-4 flex flex-wrap items-start justify-between gap-3">
		<div class="space-y-1">
			<p class="font-mono text-xs text-muted-foreground">{rule.code}</p>
			<AppInput
				{...ruleForm.fields.name.as('text')}
				required
				class="w-auto rounded-xl border border-border bg-white px-3 py-1.5 font-semibold focus:ring-2 focus:ring-zinc-950"
			/>
		</div>
		<AppButton type="submit">保存</AppButton>
	</div>

	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
		<div class="grid gap-1">
			<span class="text-xs font-medium text-muted-emphasis">最大ゲーム</span>
			<AppInput type="number" {...ruleForm.fields.maxGames.as('text')} min="1" />
		</div>
		<div class="grid gap-1">
			<span class="text-xs font-medium text-muted-emphasis">必要ゲーム</span>
			<AppInput type="number" {...ruleForm.fields.gamesToWin.as('text')} min="1" />
		</div>
		<div class="grid gap-1">
			<span class="text-xs font-medium text-muted-emphasis">勝利点</span>
			<AppInput type="number" {...ruleForm.fields.pointsToWin.as('text')} min="1" />
		</div>
		<div class="grid gap-1">
			<span class="text-xs font-medium text-muted-emphasis">デュース差</span>
			<AppInput type="number" {...ruleForm.fields.winBy.as('text')} min="1" />
		</div>
		<div class="grid gap-1">
			<span class="text-xs font-medium text-muted-emphasis">上限点</span>
			<AppInput type="number" {...ruleForm.fields.maxPoints.as('text')} min="1" />
		</div>
		<div class="grid gap-1">
			<span class="text-xs font-medium text-muted-emphasis">インターバル</span>
			<AppInput type="number" {...ruleForm.fields.midGameIntervalPoint.as('text')} min="1" />
		</div>
	</div>

	<FormToast result={ruleForm.result} />
</form>
