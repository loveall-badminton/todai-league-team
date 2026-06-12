<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import { updateSettings, updateScoringRule } from './settings.remote';

	let { data }: PageProps = $props();

	let scoringRuleItems = $derived(
		data.scoringRules.map((r) => ({ value: r.id, label: r.name ?? r.code }))
	);

	const lineupRevealItems = [
		{ value: 'on_tie_start', label: 'tie開始時に公開' },
		{ value: 'manual', label: '手動公開' }
	];
</script>

<svelte:head>
	<title>設定 | 東大リーグ団体戦</title>
</svelte:head>

<div class="px-4 py-6 sm:px-6">
	<div class="space-y-6">
		<h1 class="text-xl font-semibold text-zinc-950">設定</h1>

		<!-- League settings -->
		<section class="rounded-xl border border-zinc-200 bg-white p-5">
			<h2 class="mb-4 font-semibold text-zinc-900">運営設定</h2>
			<form {...updateSettings} class="space-y-4">
				<div class="grid gap-1">
					<span class="text-sm font-medium text-zinc-700">大会名</span>
					<AppInput name="eventName" value={data.settings.eventName} required />
				</div>

				<div class="grid gap-4 sm:grid-cols-3">
					<div class="grid gap-1">
						<span class="text-sm font-medium text-zinc-700">予選ルール</span>
						<AppSelect
							name="groupStageScoringRuleId"
							value={data.settings.groupStageScoringRuleId ?? ''}
							items={scoringRuleItems}
						/>
					</div>
					<div class="grid gap-1">
						<span class="text-sm font-medium text-zinc-700">決勝系ルール</span>
						<AppSelect
							name="knockoutScoringRuleId"
							value={data.settings.knockoutScoringRuleId ?? ''}
							items={scoringRuleItems}
						/>
					</div>
					<div class="grid gap-1">
						<span class="text-sm font-medium text-zinc-700">順位決定再試合</span>
						<AppSelect
							name="tiebreakerScoringRuleId"
							value={data.settings.tiebreakerScoringRuleId ?? ''}
							items={scoringRuleItems}
						/>
					</div>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<div class="grid gap-1">
						<span class="text-sm font-medium text-zinc-700">オーダー公開</span>
						<AppSelect
							name="lineupRevealPolicy"
							value={data.settings.lineupRevealPolicy ?? 'on_tie_start'}
							items={lineupRevealItems}
						/>
					</div>
					<div class="grid gap-1">
						<span class="text-sm font-medium text-zinc-700">提出期限 (開始前の分数)</span>
						<AppInput
							type="number"
							name="defaultLineupDueMinutesBefore"
							value={data.settings.defaultLineupDueMinutesBefore}
							min="0"
						/>
					</div>
				</div>

				<div class="flex justify-end border-t border-zinc-100 pt-4">
					<button
						class="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
					>
						保存
					</button>
				</div>
			</form>
			{#if updateSettings.result?.message}
				<div
					class="mt-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700"
				>
					{updateSettings.result.message}
				</div>
			{/if}
		</section>

		<!-- Accounts -->
		<section class="rounded-xl border border-zinc-200 bg-white p-5">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 class="font-semibold text-zinc-900">ユーザー管理</h2>
					<p class="mt-1 text-sm text-zinc-500">運営、一般参加者、チーム用のIDを管理します。</p>
				</div>
				<a
					href={resolve('/settings/accounts')}
					class="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
				>
					開く
				</a>
			</div>
		</section>

		<!-- Scoring rules -->
		<section class="space-y-3">
			<h2 class="font-semibold text-zinc-900">得点ルール</h2>
			{#each data.scoringRules as rule (rule.id)}
				{@const ruleForm = updateScoringRule.for(rule.id)}
				<form {...ruleForm} class="rounded-xl border border-zinc-200 bg-white p-5">
					<input type="hidden" name="id" value={rule.id} />

					<div class="mb-4 flex flex-wrap items-start justify-between gap-3">
						<div class="space-y-1">
							<p class="font-mono text-xs text-zinc-500">{rule.code}</p>
							<AppInput
								name="name"
								value={rule.name}
								required
								class="w-auto rounded-xl border border-zinc-200 bg-white px-3 py-1.5 font-semibold focus:ring-2 focus:ring-zinc-950"
							/>
						</div>
						<button
							class="rounded-xl border border-zinc-200 bg-white px-4 py-1.5 text-sm font-medium hover:bg-zinc-50"
						>
							保存
						</button>
					</div>

					<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
						<div class="grid gap-1">
							<span class="text-xs font-medium text-zinc-600">最大ゲーム</span>
							<AppInput type="number" name="maxGames" value={rule.maxGames} min="1" />
						</div>
						<div class="grid gap-1">
							<span class="text-xs font-medium text-zinc-600">必要ゲーム</span>
							<AppInput type="number" name="gamesToWin" value={rule.gamesToWin} min="1" />
						</div>
						<div class="grid gap-1">
							<span class="text-xs font-medium text-zinc-600">勝利点</span>
							<AppInput type="number" name="pointsToWin" value={rule.pointsToWin} min="1" />
						</div>
						<div class="grid gap-1">
							<span class="text-xs font-medium text-zinc-600">デュース差</span>
							<AppInput type="number" name="winBy" value={rule.winBy} min="1" />
						</div>
						<div class="grid gap-1">
							<span class="text-xs font-medium text-zinc-600">上限点</span>
							<AppInput type="number" name="maxPoints" value={rule.maxPoints} min="1" />
						</div>
						<div class="grid gap-1">
							<span class="text-xs font-medium text-zinc-600">インターバル</span>
							<AppInput
								type="number"
								name="midGameIntervalPoint"
								value={rule.midGameIntervalPoint}
								min="1"
							/>
						</div>
					</div>

					{#if ruleForm.result?.message}
						<div
							class="mt-3 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700"
						>
							{ruleForm.result.message}
						</div>
					{/if}
				</form>
			{/each}
		</section>
	</div>
</div>
