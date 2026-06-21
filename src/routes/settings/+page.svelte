<script lang="ts">
	import { resolve } from '$app/paths';
	import AppButton from '$lib/components/AppButton.svelte';
	import Card from '$lib/components/Card.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import type { PageProps } from './$types';
	import LeagueSettingsForm from './LeagueSettingsForm.svelte';
	import ScoringRuleForm from './ScoringRuleForm.svelte';

	let { data }: PageProps = $props();

	let scoringRuleItems = $derived(
		data.scoringRules.map((r) => ({ value: r.id, label: r.name ?? r.code }))
	);

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
<Card>
	{#snippet header()}
		<h2 class="font-semibold text-zinc-950">運営設定</h2>
	{/snippet}
	<LeagueSettingsForm settings={data.settings} {scoringRuleItems} {lineupRevealItems} />
</Card>

<!-- Accounts -->
<Card>
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h2 class="font-semibold text-zinc-950">ユーザー管理</h2>
			<p class="mt-1 text-sm text-zinc-500">運営、一般参加者、チーム用のIDを管理します。</p>
		</div>
		<AppButton variant="secondary" href={resolve('/settings/accounts')}>開く</AppButton>
	</div>
</Card>

<!-- Scoring rules -->
<section class="space-y-3">
	<h2 class="font-semibold text-zinc-950">得点ルール</h2>
	{#each data.scoringRules as rule (rule.id)}
		<Card>
			<ScoringRuleForm {rule} />
		</Card>
	{/each}
</section>
