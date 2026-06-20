import { describe, expect, test } from 'vitest';
import { buildProgressionFromEvents, type ProgressionEvent } from '$lib/utils/scoreProgression';
import { applyRealtimeProgressionEvent } from './progressionRealtime';

function rally(seqNo: number, scoreA: number, scoreB: number): ProgressionEvent {
	return {
		type: 'rally_won',
		seqNo,
		gameNo: 1,
		scoreA,
		scoreB,
		targetSeqNo: null
	};
}

describe('applyRealtimeProgressionEvent', () => {
	test('rebuilds progression correctly when undo_applied arrives over realtime', () => {
		const initialEvents = [rally(1, 1, 0), rally(2, 1, 1), rally(3, 2, 1)];
		const state = {
			eventsByMatchId: { m1: initialEvents },
			byMatchId: { m1: buildProgressionFromEvents(initialEvents) }
		};

		const next = applyRealtimeProgressionEvent(
			'm1',
			{ type: 'undo_applied', seqNo: 4, targetSeqNo: 2 },
			state
		);

		expect(next).not.toBe('refresh');
		expect(next).not.toBeNull();
		if (next === 'refresh' || next === null) return;

		expect(next.eventsByMatchId.m1).toEqual([
			...initialEvents,
			{
				type: 'undo_applied',
				seqNo: 4,
				gameNo: null,
				scoreA: null,
				scoreB: null,
				targetSeqNo: 2
			}
		]);
		expect(next.byMatchId.m1).toEqual([{ gameNo: 1, scoreA: 1, scoreB: 0 }]);
	});

	test('keeps rescored rally after undo in the rebuilt progression', () => {
		const initialEvents = [rally(1, 1, 0), rally(2, 1, 1), rally(3, 2, 1)];
		const undone = applyRealtimeProgressionEvent(
			'm1',
			{ type: 'undo_applied', seqNo: 4, targetSeqNo: 2 },
			{
				eventsByMatchId: { m1: initialEvents },
				byMatchId: { m1: buildProgressionFromEvents(initialEvents) }
			}
		);
		if (undone === 'refresh' || undone === null) throw new Error('expected updated state');

		const rescored = applyRealtimeProgressionEvent(
			'm1',
			{ type: 'rally_won', seqNo: 5, gameNo: 1, scoreA: 2, scoreB: 0 },
			undone
		);
		if (rescored === 'refresh' || rescored === null) throw new Error('expected updated state');

		expect(rescored.byMatchId.m1).toEqual([
			{ gameNo: 1, scoreA: 1, scoreB: 0 },
			{ gameNo: 1, scoreA: 2, scoreB: 0 }
		]);
	});

	test('requests refresh when the live page has no event history for the match', () => {
		const result = applyRealtimeProgressionEvent(
			'missing',
			{ type: 'undo_applied', seqNo: 2, targetSeqNo: 1 },
			{ byMatchId: {}, eventsByMatchId: {} }
		);

		expect(result).toBe('refresh');
	});
});
