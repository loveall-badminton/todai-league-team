<script lang="ts">
	import type { GameState, LetCalledInput, ServiceState, MatchPlayer } from '$lib/domain/types';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import AppTextarea from '$lib/components/AppTextarea.svelte';
	import Card from '$lib/components/Card.svelte';
	import CollapsibleSection from '$lib/components/CollapsibleSection.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import { toast } from 'svelte-sonner';
	import { correction, cutoff, letCalled, forfeit, retire } from './referee.remote';

	let {
		currentGame,
		sideAName,
		sideBName,
		service,
		players,
		currentGameNo
	}: {
		currentGame: GameState | undefined;
		sideAName: string;
		sideBName: string;
		service: ServiceState | null | undefined;
		players: MatchPlayer[];
		currentGameNo: number;
	} = $props();

	async function run(fn: () => Promise<unknown>) {
		try {
			await fn();
			// Invalidation handled by parent page's realtime flow (createRealtimeQueryFlow)
		} catch (e) {
			toast.error(e instanceof Error ? e.message : '操作に失敗しました');
		}
	}

	let letReason = $state<LetCalledInput['reason']>('receiver_not_ready');
	let letNote = $state('');

	let correctionScoreA = $state(0);
	let correctionScoreB = $state(0);
	let correctionReason = $state('');
	let correctionServingSide = $state('');
	let correctionServiceCourt = $state('');
	let correctionServerPlayerId = $state('');
	let correctionReceiverPlayerId = $state('');

	let courtAssignmentsJson = $derived(
		service?.discipline === 'doubles' ? JSON.stringify(service.courtAssignments) : ''
	);
	let servingSideItems = $derived([
		{ value: '', label: 'サービスサイド変更なし' },
		{ value: 'A', label: sideAName },
		{ value: 'B', label: sideBName }
	]);
	const serviceCourtItems = [
		{ value: '', label: 'サービスコート変更なし' },
		{ value: 'right', label: '右' },
		{ value: 'left', label: '左' }
	];
	let allPlayerCorrectionItems = $derived([
		{ value: '', label: 'サーバー変更なし' },
		...players.map((p) => ({ value: p.id, label: p.name }))
	]);
	let allReceiverCorrectionItems = $derived([
		{ value: '', label: 'レシーバー変更なし' },
		...players.map((p) => ({ value: p.id, label: p.name }))
	]);
	const letReasonItems = [
		{ value: 'receiver_not_ready', label: 'レシーバー未準備' },
		{ value: 'both_faulted', label: '双方フォルト' },
		{ value: 'shuttle_caught_on_net', label: 'ネットに引っかかった' },
		{ value: 'shuttle_disintegrated', label: 'シャトル破損' },
		{ value: 'line_judge_unsighted', label: '線審視認不能' },
		{ value: 'unforeseen_situation', label: '予期しない状況' },
		{ value: 'other', label: 'その他' }
	];

	async function applyCorrectionFromForm() {
		if (!correctionReason) return;
		await run(() =>
			correction({
				gameNo: currentGameNo,
				scoreA: correctionScoreA,
				scoreB: correctionScoreB,
				reason: correctionReason,
				servingSide: correctionServingSide || undefined,
				serviceCourt: correctionServiceCourt || undefined,
				serverPlayerId: correctionServerPlayerId || undefined,
				receiverPlayerId: correctionReceiverPlayerId || undefined,
				courtAssignmentsJson: courtAssignmentsJson || undefined
			})
		);
	}

	$effect(() => {
		if (!currentGame) return;
		correctionScoreA = currentGame.score.A;
		correctionScoreB = currentGame.score.B;
		correctionReason = '';
		correctionServingSide = service?.servingSide ?? '';
		correctionServiceCourt = service?.serviceCourt ?? '';
		correctionServerPlayerId = service?.serverPlayerId ?? '';
		correctionReceiverPlayerId = service?.receiverPlayerId ?? '';
	});
</script>

<Card flush class="overflow-hidden">
	{#snippet header()}
		<h2 class="text-xs font-medium tracking-tight text-muted">高度な操作</h2>
	{/snippet}
	<div class="divide-y divide-zinc-100">
		<CollapsibleSection title="スコア訂正">
			<form
				onsubmit={(e) => {
					e.preventDefault();
				}}
				class="grid gap-3"
			>
				<div class="grid grid-cols-2 gap-2">
					<AppInput
						type="number"
						placeholder={`${sideAName} スコア`}
						bind:value={correctionScoreA}
					/>
					<AppInput
						type="number"
						placeholder={`${sideBName} スコア`}
						bind:value={correctionScoreB}
					/>
				</div>
				<AppInput placeholder="訂正理由" bind:value={correctionReason} required />
				<CollapsibleSection title="サービス状態も訂正" class="rounded-xl bg-zinc-100 p-4">
					<div class="grid gap-2">
						<AppSelect
							name="servingSide"
							bind:value={correctionServingSide}
							items={servingSideItems}
						/>
						<AppSelect
							name="serviceCourt"
							bind:value={correctionServiceCourt}
							items={serviceCourtItems}
						/>
						<AppSelect
							name="serverPlayerId"
							bind:value={correctionServerPlayerId}
							items={allPlayerCorrectionItems}
						/>
						<AppSelect
							name="receiverPlayerId"
							bind:value={correctionReceiverPlayerId}
							items={allReceiverCorrectionItems}
						/>
						{#if service?.discipline === 'doubles'}
							<AppTextarea class="min-h-20 font-mono text-xs" readonly
								>{courtAssignmentsJson}</AppTextarea
							>
						{/if}
					</div>
				</CollapsibleSection>
				<ConfirmDialog
					onConfirm={applyCorrectionFromForm}
					triggerLabel="訂正する"
					triggerVariant="primary"
					triggerFullWidth
					triggerClass="px-4 py-3 font-bold shadow-sm"
					title="スコアを訂正しますか？"
					description="現在のゲームスコアと必要に応じてサービス状態を上書きします。入力内容を確認してください。"
					confirmLabel="訂正を確定する"
				/>
			</form>
		</CollapsibleSection>

		<CollapsibleSection title="レット">
			<div class="grid gap-3">
				<AppSelect name="letReason" bind:value={letReason} items={letReasonItems} />
				<AppInput name="letNote" bind:value={letNote} placeholder="メモ" />
				<ConfirmDialog
					onConfirm={() => run(() => letCalled({ reason: letReason, note: letNote || undefined }))}
					triggerLabel="記録する"
					triggerVariant="primary"
					triggerFullWidth
					triggerClass="px-4 py-3 font-bold shadow-sm"
					title="レットを記録しますか？"
					description="スコアは変えずにレットのイベントだけを記録します。"
					confirmLabel="レットを記録する"
				/>
			</div>
		</CollapsibleSection>

		<CollapsibleSection title="棄権">
			<div class="grid grid-cols-2 gap-2">
				<ConfirmDialog
					onConfirm={() => run(() => forfeit({ side: 'A' }))}
					triggerLabel="{sideAName} 棄権"
					triggerVariant="danger"
					title="{sideAName}を棄権にしますか？"
					description="{sideBName}を勝者として試合を棄権終了にします。"
					confirmLabel="棄権を確定する"
					confirmVariant="danger"
				/>
				<ConfirmDialog
					onConfirm={() => run(() => forfeit({ side: 'B' }))}
					triggerLabel="{sideBName} 棄権"
					triggerVariant="danger"
					title="{sideBName}を棄権にしますか？"
					description="{sideAName}を勝者として試合を棄権終了にします。"
					confirmLabel="棄権を確定する"
					confirmVariant="danger"
				/>
			</div>
		</CollapsibleSection>

		<CollapsibleSection title="リタイア">
			<div class="grid grid-cols-2 gap-2">
				<ConfirmDialog
					onConfirm={() => run(() => retire({ side: 'A' }))}
					triggerLabel="{sideAName} リタイア"
					triggerVariant="danger"
					title="{sideAName}をリタイアにしますか？"
					description="{sideBName}を勝者として試合をリタイア終了にします。"
					confirmLabel="リタイアを確定する"
					confirmVariant="danger"
				/>
				<ConfirmDialog
					onConfirm={() => run(() => retire({ side: 'B' }))}
					triggerLabel="{sideBName} リタイア"
					triggerVariant="danger"
					title="{sideBName}をリタイアにしますか？"
					description="{sideAName}を勝者として試合をリタイア終了にします。"
					confirmLabel="リタイアを確定する"
					confirmVariant="danger"
				/>
			</div>
		</CollapsibleSection>

		<CollapsibleSection title="打ち切り">
			<ConfirmDialog
				onConfirm={() => run(() => cutoff())}
				triggerLabel="打ち切りにする"
				triggerVariant="danger"
				triggerFullWidth
				title="種目を打ち切りますか？"
				description="この種目を打ち切りにします。スコアは記録されますが、勝者なしで終了します。この操作は取り消せません。"
				confirmLabel="打ち切りを確定する"
				confirmVariant="danger"
			/>
		</CollapsibleSection>
	</div>
</Card>
