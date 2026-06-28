<script lang="ts">
	import AppTextarea from '$lib/components/AppTextarea.svelte';
	import Card from '$lib/components/Card.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import { courtDisplayLabel, rubberLabel } from '$lib/domain/tokyoLeagueLabels';
	import { MessageSquareDashed } from '@lucide/svelte';

	type TieSlot = {
		tieCode: string;
		lineupDueAt: string | null;
		venue: string | null;
		courtBlockCode: string | null;
		teamScoreA: number;
		teamScoreB: number;
	};

	type RubberSlot = {
		code: string;
		winnerSide: 'A' | 'B' | null;
		gameDetails: { scoreA: number; scoreB: number }[];
	};

	let {
		tie,
		teamAName,
		teamBName,
		rubbers
	}: {
		tie: TieSlot;
		teamAName: string | null;
		teamBName: string | null;
		rubbers: RubberSlot[];
	} = $props();

	function reminderTemplate() {
		const nA = teamAName ?? 'A側';
		const nB = teamBName ?? 'B側';
		return [
			'【オーダー提出のお願い】',
			`${tie.tieCode}（${nA} vs ${nB}）`,
			`提出期限：${tie.lineupDueAt ?? '（未設定）'}`,
			'',
			'オーダーの提出をお願いします。'
		].join('\n');
	}

	function callTemplate() {
		const nA = teamAName ?? 'A側';
		const nB = teamBName ?? 'B側';
		const court = courtDisplayLabel(tie.venue, tie.courtBlockCode);
		return ['【コール】', `${tie.tieCode}（${nA} vs ${nB}）`, `${court}にお集まりください。`].join(
			'\n'
		);
	}

	function resultTemplate() {
		const nA = teamAName ?? 'A側';
		const nB = teamBName ?? 'B側';
		const played = rubbers.filter((r) => r.winnerSide);
		const rubberLines = played
			.map((r) => {
				const winner = r.winnerSide === 'A' ? nA : nB;
				const scores = r.gameDetails.length
					? '（' + r.gameDetails.map((g) => `${g.scoreA}-${g.scoreB}`).join(', ') + '）'
					: '';
				return `${rubberLabel(r.code)}：${winner}${scores}`;
			})
			.join('\n');
		return [
			'【試合結果】',
			`${tie.tieCode}`,
			`${nA} ${tie.teamScoreA} - ${tie.teamScoreB} ${nB}`,
			...(rubberLines ? ['', rubberLines] : [])
		].join('\n');
	}

	let reminderText = $state(reminderTemplate());
	let callText = $state(callTemplate());
	let resultText = $state(resultTemplate());
	// $state initializers run once at mount. liveRubbers loads asynchronously after mount
	// so gameDetails is initially empty. Re-seed exactly once when scores arrive.
	let resultSeeded = $state(false);
	$effect(() => {
		if (!resultSeeded && rubbers.some((r) => r.gameDetails.length > 0)) {
			resultSeeded = true;
			resultText = resultTemplate();
		}
	});
</script>

<Card flush>
	{#snippet header()}
		<div class="flex items-center gap-2">
			<MessageSquareDashed class="size-4 text-muted-foreground" />
			<h2 class="text-sm font-semibold text-default">チャット通知文面</h2>
		</div>
	{/snippet}

	<div class="divide-y divide-border-subtle">
		<div class="space-y-2 px-5 py-4">
			<div class="flex items-center justify-between">
				<p class="text-xs font-medium text-zinc-600">オーダー提出催促</p>
				<CopyButton text={reminderText} />
			</div>
			<AppTextarea bind:value={reminderText} rows={5} class="text-xs" />
		</div>

		<div class="space-y-2 px-5 py-4">
			<div class="flex items-center justify-between">
				<p class="text-xs font-medium text-zinc-600">コール</p>
				<CopyButton text={callText} />
			</div>
			<AppTextarea bind:value={callText} rows={4} class="text-xs" />
		</div>

		<div class="space-y-2 px-5 py-4">
			<div class="flex items-center justify-between">
				<p class="text-xs font-medium text-zinc-600">試合結果</p>
				<CopyButton text={resultText} />
			</div>
			<AppTextarea bind:value={resultText} rows={7} class="text-xs" />
		</div>
	</div>
</Card>
