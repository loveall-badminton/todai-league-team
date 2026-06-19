<script lang="ts">
	import Card from '$lib/components/Card.svelte';

	interface EventRow {
		id: string;
		seqNo: number;
		eventType: string;
		scoreAAfter: number | null;
		scoreBAfter: number | null;
	}

	let { events }: { events: EventRow[] } = $props();

	let reversedEvents = $derived([...events].reverse());

	const eventTypeLabel: Record<string, string> = {
		match_started: '試合開始',
		game_started: 'ゲーム開始',
		rally_won: 'ラリー得点',
		undo: '取り消し',
		undo_applied: '取り消し',
		correction: 'スコア訂正',
		correction_applied: 'スコア訂正',
		let_called: 'レット',
		match_suspended: '試合中断',
		match_resumed: '試合再開',
		side_forfeited: '棄権',
		side_retired: 'リタイア',
		match_finished: '試合終了',
		match_confirmed: '結果確定',
		match_unconfirmed: '承認解除'
	};

	function eventLabel(eventType: string): string {
		return eventTypeLabel[eventType] ?? eventType;
	}
</script>

<Card class="p-5">
	<h2 class="mb-3 text-xs font-medium tracking-wide text-zinc-400">イベントログ</h2>
	<div class="max-h-72 space-y-1.5 overflow-auto">
		{#each reversedEvents as event (event.id)}
			<div
				class="grid grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2 text-sm"
			>
				<span class="text-zinc-400 tabular-nums">#{event.seqNo}</span>
				<span class="text-zinc-700">{eventLabel(event.eventType)}</span>
				<span class="font-medium text-zinc-500 tabular-nums">
					{event.scoreAAfter ?? '-'}–{event.scoreBAfter ?? '-'}
				</span>
			</div>
		{/each}
	</div>
</Card>
