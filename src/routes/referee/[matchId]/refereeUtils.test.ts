import { describe, expect, test } from 'vitest';
import { findLastUndoableEvent, undoLabel, playerOptions } from './refereeUtils';

const UNDOABLE = [
	'rally_won',
	'correction_applied',
	'match_suspended',
	'match_resumed',
	'match_started',
	'game_started'
];

// ─── findLastUndoableEvent ────────────────────────────────────────────────────

describe('findLastUndoableEvent', () => {
	test('returns null for empty event list', () => {
		expect(findLastUndoableEvent([], UNDOABLE)).toBeNull();
	});

	test('returns null when no events match undoable types', () => {
		const events = [
			{ eventType: 'undo_applied', seqNo: 1, targetSeqNo: null },
			{ eventType: 'match_confirmed', seqNo: 2, targetSeqNo: null }
		];
		expect(findLastUndoableEvent(events, UNDOABLE)).toBeNull();
	});

	test('returns the most recent undoable event', () => {
		const events = [
			{ eventType: 'match_started', seqNo: 1, targetSeqNo: null },
			{ eventType: 'rally_won', seqNo: 2, targetSeqNo: null },
			{ eventType: 'rally_won', seqNo: 3, targetSeqNo: null }
		];
		expect(findLastUndoableEvent(events, UNDOABLE)?.seqNo).toBe(3);
	});

	test('skips events that have already been undone', () => {
		const events = [
			{ eventType: 'rally_won', seqNo: 1, targetSeqNo: null },
			{ eventType: 'rally_won', seqNo: 2, targetSeqNo: null },
			{ eventType: 'undo_applied', seqNo: 3, targetSeqNo: 2 } // undoes seqNo=2
		];
		// seqNo=2 is undone; should return seqNo=1
		expect(findLastUndoableEvent(events, UNDOABLE)?.seqNo).toBe(1);
	});

	test('skips multiple already-undone events', () => {
		const events = [
			{ eventType: 'match_started', seqNo: 1, targetSeqNo: null },
			{ eventType: 'rally_won', seqNo: 2, targetSeqNo: null },
			{ eventType: 'rally_won', seqNo: 3, targetSeqNo: null },
			{ eventType: 'undo_applied', seqNo: 4, targetSeqNo: 3 },
			{ eventType: 'undo_applied', seqNo: 5, targetSeqNo: 2 }
		];
		expect(findLastUndoableEvent(events, UNDOABLE)?.seqNo).toBe(1);
	});

	test('returns null when all undoable events have been undone', () => {
		const events = [
			{ eventType: 'rally_won', seqNo: 1, targetSeqNo: null },
			{ eventType: 'undo_applied', seqNo: 2, targetSeqNo: 1 }
		];
		expect(findLastUndoableEvent(events, UNDOABLE)).toBeNull();
	});

	test('does not treat undo_applied itself as undoable', () => {
		const events = [{ eventType: 'undo_applied', seqNo: 1, targetSeqNo: null }];
		expect(findLastUndoableEvent(events, UNDOABLE)).toBeNull();
	});

	test('works with all undoable event types', () => {
		for (const eventType of UNDOABLE) {
			const events = [{ eventType, seqNo: 1, targetSeqNo: null }];
			expect(findLastUndoableEvent(events, UNDOABLE)?.eventType).toBe(eventType);
		}
	});
});

// ─── undoLabel ───────────────────────────────────────────────────────────────

describe('undoLabel', () => {
	test('formats rally_won for side A with score', () => {
		const event = {
			eventType: 'rally_won',
			seqNo: 5,
			targetSeqNo: null,
			side: 'A',
			scoreAAfter: 10,
			scoreBAfter: 8
		};
		expect(undoLabel(event, 'チームA', 'チームB')).toBe('チームA 得点 (10–8)');
	});

	test('formats rally_won for side B with score', () => {
		const event = {
			eventType: 'rally_won',
			seqNo: 6,
			targetSeqNo: null,
			side: 'B',
			scoreAAfter: 10,
			scoreBAfter: 9
		};
		expect(undoLabel(event, 'チームA', 'チームB')).toBe('チームB 得点 (10–9)');
	});

	test('uses ? for rally_won with unknown side', () => {
		const event = {
			eventType: 'rally_won',
			seqNo: 1,
			targetSeqNo: null,
			side: null,
			scoreAAfter: 5,
			scoreBAfter: 3
		};
		expect(undoLabel(event, 'A', 'B')).toContain('?');
	});

	test('returns サービス設定 for match_started', () => {
		const event = { eventType: 'match_started', seqNo: 1, targetSeqNo: null };
		expect(undoLabel(event, 'A', 'B')).toBe('サービス設定');
	});

	test('returns サービス設定 for game_started', () => {
		const event = { eventType: 'game_started', seqNo: 2, targetSeqNo: null };
		expect(undoLabel(event, 'A', 'B')).toBe('サービス設定');
	});

	test('returns 中断 for match_suspended', () => {
		const event = { eventType: 'match_suspended', seqNo: 3, targetSeqNo: null };
		expect(undoLabel(event, 'A', 'B')).toBe('中断');
	});

	test('returns 再開 for match_resumed', () => {
		const event = { eventType: 'match_resumed', seqNo: 4, targetSeqNo: null };
		expect(undoLabel(event, 'A', 'B')).toBe('再開');
	});

	test('returns 訂正 for correction_applied', () => {
		const event = { eventType: 'correction_applied', seqNo: 5, targetSeqNo: null };
		expect(undoLabel(event, 'A', 'B')).toBe('訂正');
	});

	test('returns raw eventType for unknown event types', () => {
		const event = { eventType: 'some_future_event', seqNo: 9, targetSeqNo: null };
		expect(undoLabel(event, 'A', 'B')).toBe('some_future_event');
	});
});

// ─── playerOptions ────────────────────────────────────────────────────────────

describe('playerOptions', () => {
	test('converts players to {value, label} items', () => {
		const players = [
			{ id: 'p1', name: 'Alice' },
			{ id: 'p2', name: 'Bob' }
		];
		expect(playerOptions(players)).toEqual([
			{ value: 'p1', label: 'Alice' },
			{ value: 'p2', label: 'Bob' }
		]);
	});

	test('returns empty array for empty input', () => {
		expect(playerOptions([])).toEqual([]);
	});

	test('preserves player order', () => {
		const players = [
			{ id: 'z', name: 'Zara' },
			{ id: 'a', name: 'Amy' }
		];
		const result = playerOptions(players);
		expect(result[0].value).toBe('z');
		expect(result[1].value).toBe('a');
	});
});
