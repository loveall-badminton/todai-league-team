<script lang="ts">
	import type { LetCalledInput } from '$lib/domain/types';
	import type { LiveTopicPayloadMap } from '$lib/realtime/channels';
	import AppInput from '$lib/components/ui/AppInput.svelte';
	import AppSelect from '$lib/components/ui/AppSelect.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CollapsibleSection from '$lib/components/ui/CollapsibleSection.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import { cutoffCommand, letCalledCommand, forfeitCommand, retireCommand } from './referee.remote';

	type ScoreActionResult = {
		error?: string;
		scorePayload?: LiveTopicPayloadMap['score'];
	};

	let {
		sideAName,
		sideBName,
		applyScoreAction
	}: {
		sideAName: string;
		sideBName: string;
		applyScoreAction: (run: () => Promise<ScoreActionResult>) => Promise<void>;
	} = $props();

	let letReason: LetCalledInput['reason'] = $state('receiver_not_ready');
	let letNote = $state('');

	const letReasonItems = [
		{ value: 'receiver_not_ready', label: 'レシーバー未準備' },
		{ value: 'both_faulted', label: '双方フォルト' },
		{ value: 'shuttle_caught_on_net', label: 'ネットに引っかかった' },
		{ value: 'shuttle_disintegrated', label: 'シャトル破損' },
		{ value: 'line_judge_unsighted', label: '線審視認不能' },
		{ value: 'unforeseen_situation', label: '予期しない状況' },
		{ value: 'other', label: 'その他' }
	];
</script>

<Card flush class="overflow-hidden">
	{#snippet header()}
		<h2 class="text-xs font-medium tracking-tight text-muted">高度な操作</h2>
	{/snippet}
	<div class="divide-y divide-zinc-100">
		<CollapsibleSection title="レット">
			<div class="grid gap-3">
				<AppSelect name="letReason" bind:value={letReason} items={letReasonItems} />
				<AppInput name="letNote" bind:value={letNote} placeholder="メモ" />
				<ConfirmDialog
					onConfirm={() =>
						applyScoreAction(() =>
							letCalledCommand({ reason: letReason, note: letNote || undefined })
						)}
					hiddenFields={[
						{ name: 'reason', value: letReason },
						{ name: 'note', value: letNote }
					]}
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
					onConfirm={() => applyScoreAction(() => forfeitCommand({ side: 'A' }))}
					triggerLabel="{sideAName} 棄権"
					triggerVariant="danger"
					title="{sideAName}を棄権にしますか？"
					description="{sideBName}を勝者として試合を棄権終了にします。"
					confirmLabel="棄権を確定する"
					confirmVariant="danger"
				/>
				<ConfirmDialog
					onConfirm={() => applyScoreAction(() => forfeitCommand({ side: 'B' }))}
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
					onConfirm={() => applyScoreAction(() => retireCommand({ side: 'A' }))}
					triggerLabel="{sideAName} リタイア"
					triggerVariant="danger"
					title="{sideAName}をリタイアにしますか？"
					description="{sideBName}を勝者として試合をリタイア終了にします。"
					confirmLabel="リタイアを確定する"
					confirmVariant="danger"
				/>
				<ConfirmDialog
					onConfirm={() => applyScoreAction(() => retireCommand({ side: 'B' }))}
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
				onConfirm={() => applyScoreAction(() => cutoffCommand())}
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
