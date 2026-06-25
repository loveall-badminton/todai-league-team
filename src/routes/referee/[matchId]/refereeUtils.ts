import type { SelectItem } from '$lib/types/ui';
import type { EntityOption } from '$lib/types/entities';

export type ScoreEvent = {
	eventType: string;
	seqNo: number;
	targetSeqNo: number | null;
	side?: string | null;
	scoreAAfter?: number | null;
	scoreBAfter?: number | null;
};

type DisplaySideOrder = {
	left: 'A' | 'B';
	right: 'A' | 'B';
};

/**
 * イベントリストから「まだ取り消されていない最後の取り消し可能イベント」を返す。
 * 取り消し済みのイベント（undo_applied の targetSeqNo に一致するもの）は除外する。
 */
export function findLastUndoableEvent<T extends ScoreEvent>(
	events: T[],
	undoableTypes: string[]
): T | null {
	const undoneSeqNos = new Set(
		events
			.filter((e) => e.eventType === 'undo_applied' && e.targetSeqNo != null)
			.map((e) => e.targetSeqNo!)
	);
	return (
		[...events]
			.reverse()
			.find((e) => undoableTypes.includes(e.eventType) && !undoneSeqNos.has(e.seqNo)) ?? null
	);
}

/**
 * アンドゥ対象イベントのラベルを返す。審判画面の「取り消し」ボタン表示用。
 */
export function undoLabel(
	event: ScoreEvent,
	sideAName: string,
	sideBName: string,
	displayOrder: DisplaySideOrder = { left: 'A', right: 'B' }
): string {
	if (event.eventType === 'rally_won') {
		const name = event.side === 'A' ? sideAName : event.side === 'B' ? sideBName : '?';
		const leftScore = displayOrder.left === 'A' ? event.scoreAAfter : event.scoreBAfter;
		const rightScore = displayOrder.right === 'A' ? event.scoreAAfter : event.scoreBAfter;
		return `${name} 得点 (${leftScore}–${rightScore})`;
	}
	if (event.eventType === 'match_started' || event.eventType === 'game_started')
		return 'サービス設定';
	if (event.eventType === 'match_suspended') return '中断';
	if (event.eventType === 'match_resumed') return '再開';
	if (event.eventType === 'correction_applied') return '訂正';
	return event.eventType;
}

/**
 * MatchPlayer 配列を AppSelect 用の {value, label} 配列に変換する。
 */
export function playerOptions(players: EntityOption[]): SelectItem[] {
	return players.map((p) => ({ value: p.id, label: p.name }));
}
