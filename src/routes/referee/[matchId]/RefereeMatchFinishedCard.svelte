<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import Callout from '$lib/components/Callout.svelte';
	import Card from '$lib/components/Card.svelte';
	import { confirmWinner, saveRefereeName, unconfirmWinner } from './referee.remote';

	interface Props {
		status: 'finished' | 'forfeited' | 'retired';
		refereeName: string;
		winnerSideName: string | null;
		winnerConfirmed: boolean;
		hasRefereeName: boolean;
		isLocked: boolean;
		isScoringLocked: boolean;
		scoreText: string | null;
	}

	let {
		status,
		refereeName,
		winnerSideName,
		winnerConfirmed,
		hasRefereeName,
		isLocked,
		isScoringLocked,
		scoreText
	}: Props = $props();
	let initialRefereeName = $derived(refereeName);
</script>

<Card>
	<h2 class="font-semibold">試合終了操作</h2>
	<p class="mt-1 text-sm text-muted">
		{status === 'forfeited'
			? '棄権により試合が終了しました'
			: status === 'retired'
				? 'リタイアにより試合が終了しました'
				: '試合が終了しました'}
	</p>
	<div class="mt-4 grid gap-3">
		<form {...saveRefereeName} class="grid-cols-[1fr_auto] gap-2 grid">
			<div class="grid gap-1">
				<label class="text-xs font-medium text-muted-foreground" for="referee-name">審判名</label>
				<AppInput
					{...saveRefereeName.fields.refereeName.as('text', initialRefereeName)}
					id="referee-name"
					placeholder="審判の名前を入力"
					required
					disabled={isScoringLocked}
				/>
			</div>
			<div class="self-end">
				<AppButton type="submit" disabled={isScoringLocked || saveRefereeName.pending > 0}>
					{saveRefereeName.pending > 0 ? '保存中…' : '保存'}
				</AppButton>
			</div>
		</form>

		{#if winnerSideName}
			<div class="mt-2 flex flex-col gap-2">
				<p class="text-xs font-medium text-muted-foreground">
					<strong>勝者（{winnerSideName}）</strong>に試合結果の確認を求めてください
				</p>
				{#if winnerConfirmed}
					<form {...unconfirmWinner} class="contents">
						<AppButton type="submit" variant="secondary" class="w-full" disabled={isLocked}>
							確認を取り消す
						</AppButton>
					</form>
				{:else}
					<form {...confirmWinner} class="contents">
						<AppButton
							type="submit"
							variant="success"
							class="w-full"
							size="lg"
							disabled={isScoringLocked || !hasRefereeName}
						>
							<span class="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-emerald-600">
								勝者
							</span>
							試合結果を確認
						</AppButton>
					</form>
					{#if scoreText}
						<p class="text-center text-xs text-muted-foreground">（{scoreText}）</p>
					{/if}
				{/if}
			</div>
		{/if}

		{#if winnerConfirmed && hasRefereeName}
			<Callout>
				<p class="text-sm">シャトルを本部に戻し、終了を報告してください。</p>
			</Callout>
		{/if}
	</div>
</Card>
