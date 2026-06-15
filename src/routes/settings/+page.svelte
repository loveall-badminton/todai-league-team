<script lang="ts">
	import { resolve } from '$app/paths';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import Card from '$lib/components/Card.svelte';
	import FormToast from '$lib/components/FormToast.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';
	import { updateScoringRule, updateSettings } from './settings.remote';

	let { data }: PageProps = $props();

	let scoringRuleItems = $derived(
		data.scoringRules.map((r) => ({ value: r.id, label: r.name ?? r.code }))
	);

	onMount(() => {
		updateSettings.fields.set({
			eventName: data.settings.eventName,
			groupStageScoringRuleId: data.settings.groupStageScoringRuleId ?? '',
			knockoutScoringRuleId: data.settings.knockoutScoringRuleId ?? '',
			tiebreakerScoringRuleId: data.settings.tiebreakerScoringRuleId ?? '',
			lineupRevealPolicy: data.settings.lineupRevealPolicy ?? 'on_tie_start',
			defaultLineupDueMinutesBefore: String(data.settings.defaultLineupDueMinutesBefore)
		});
	});

	const lineupRevealItems = [
		{ value: 'on_tie_start', label: '試合開始時に公開' },
		{ value: 'manual', label: '手動公開' }
	];
</script>

<svelte:head>
	<title>設定 | 東大リーグ団体戦</title>
</svelte:head>

<PageHeader title="設定" />

<!-- League settings -->
<Card class="p-5">
	<h2 class="mb-4 font-semibold text-zinc-900">運営設定</h2>
	<form {...updateSettings} class="space-y-4">
		<FormToast result={updateSettings.result} />
		<div class="grid gap-1">
			<span class="text-sm font-medium text-zinc-700">大会名</span>
			<AppInput {...updateSettings.fields.eventName.as('text')} required />
			{#each updateSettings.fields.eventName.issues() ?? [] as issue (issue.message)}
				<span class="text-xs text-red-600">{issue.message}</span>
			{/each}
		</div>

		<div class="grid gap-4 sm:grid-cols-3">
			<div class="grid gap-1">
				<span class="text-sm font-medium text-zinc-700">予選ルール</span>
				<AppSelect
					{...updateSettings.fields.groupStageScoringRuleId.as('select')}
					items={scoringRuleItems}
					onValueChange={(v) => updateSettings.fields.groupStageScoringRuleId.set(v)}
				/>
			</div>
			<div class="grid gap-1">
				<span class="text-sm font-medium text-zinc-700">決勝トーナメントルール</span>
				<AppSelect
					{...updateSettings.fields.knockoutScoringRuleId.as('select')}
					items={scoringRuleItems}
					onValueChange={(v) => updateSettings.fields.knockoutScoringRuleId.set(v)}
				/>
			</div>
			<div class="grid gap-1">
				<span class="text-sm font-medium text-zinc-700">順位決定再試合</span>
				<AppSelect
					{...updateSettings.fields.tiebreakerScoringRuleId.as('select')}
					items={scoringRuleItems}
					onValueChange={(v) => updateSettings.fields.tiebreakerScoringRuleId.set(v)}
				/>
			</div>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<div class="grid gap-1">
				<span class="text-sm font-medium text-zinc-700">オーダー公開</span>
				<AppSelect
					{...updateSettings.fields.lineupRevealPolicy.as('select')}
					items={lineupRevealItems}
					onValueChange={(v) =>
						updateSettings.fields.lineupRevealPolicy.set(v as 'on_tie_start' | 'manual')}
				/>
			</div>
			<div class="grid gap-1">
				<span class="text-sm font-medium text-zinc-700">提出期限 (開始前の分数)</span>
				<AppInput
					type="number"
					{...updateSettings.fields.defaultLineupDueMinutesBefore.as('text')}
					min="0"
				/>
			</div>
		</div>

		<div class="flex justify-end border-t border-zinc-100 pt-4">
			<AppButton type="submit">保存</AppButton>
		</div>
	</form>
</Card>

<!-- Accounts -->
<Card class="p-5">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h2 class="font-semibold text-zinc-900">ユーザー管理</h2>
			<p class="mt-1 text-sm text-zinc-500">運営、一般参加者、チーム用のIDを管理します。</p>
		</div>
		<AppButton variant="secondary" href={resolve('/settings/accounts')}>開く</AppButton>
	</div>
</Card>

<!-- Scoring rules -->
<section class="space-y-3">
	<h2 class="font-semibold text-zinc-900">得点ルール</h2>
	{#each data.scoringRules as rule (rule.id)}
		{@const ruleForm = updateScoringRule.for(rule.id)}
		<Card class="p-5"
			><form {...ruleForm}>
				<input {...ruleForm.fields.id.as('hidden', rule.id)} />

				<div class="mb-4 flex flex-wrap items-start justify-between gap-3">
					<div class="space-y-1">
						<p class="font-mono text-xs text-zinc-500">{rule.code}</p>
						<AppInput
							{...ruleForm.fields.name.as('text', rule.name)}
							required
							class="w-auto rounded-xl border border-zinc-200 bg-white px-3 py-1.5 font-semibold focus:ring-2 focus:ring-zinc-950"
						/>
					</div>
					<AppButton type="submit">保存</AppButton>
				</div>

				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
					<div class="grid gap-1">
						<span class="text-xs font-medium text-zinc-600">最大ゲーム</span>
						<AppInput
							type="number"
							{...ruleForm.fields.maxGames.as('text', String(rule.maxGames))}
							min="1"
						/>
					</div>
					<div class="grid gap-1">
						<span class="text-xs font-medium text-zinc-600">必要ゲーム</span>
						<AppInput
							type="number"
							{...ruleForm.fields.gamesToWin.as('text', String(rule.gamesToWin))}
							min="1"
						/>
					</div>
					<div class="grid gap-1">
						<span class="text-xs font-medium text-zinc-600">勝利点</span>
						<AppInput
							type="number"
							{...ruleForm.fields.pointsToWin.as('text', String(rule.pointsToWin))}
							min="1"
						/>
					</div>
					<div class="grid gap-1">
						<span class="text-xs font-medium text-zinc-600">デュース差</span>
						<AppInput
							type="number"
							{...ruleForm.fields.winBy.as('text', String(rule.winBy))}
							min="1"
						/>
					</div>
					<div class="grid gap-1">
						<span class="text-xs font-medium text-zinc-600">上限点</span>
						<AppInput
							type="number"
							{...ruleForm.fields.maxPoints.as('text', String(rule.maxPoints))}
							min="1"
						/>
					</div>
					<div class="grid gap-1">
						<span class="text-xs font-medium text-zinc-600">インターバル</span>
						<AppInput
							type="number"
							{...ruleForm.fields.midGameIntervalPoint.as(
								'text',
								String(rule.midGameIntervalPoint)
							)}
							min="1"
						/>
					</div>
				</div>

				<FormToast result={ruleForm.result} />
			</form></Card
		>
	{/each}
</section>
