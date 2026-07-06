import { describe, expect, test } from 'vitest';
import {
	DEFAULT_BWF_SCORING_CONFIG,
	type MatchState,
	type ScoreEventInput
} from '$lib/domain/types';
import {
	applyRefereeScorePayload,
	buildRealtimeScoreEvent,
	resolveRealtimeInput,
	type RefereeLiveView
} from './refereeRealtime';

function createMatchState(overrides: Partial<MatchState> = {}): MatchState {
	return {
		schemaVersion: 1,
		matchId: 'match-1',
		tournamentId: 'tournament-1',
		courtId: null,
		discipline: 'MD',
		status: 'playing',
		scoring: DEFAULT_BWF_SCORING_CONFIG,
		currentGameNo: 1,
		games: [
			{
				gameNo: 1,
				score: { A: 1, B: 0 },
				winnerSide: null,
				midGameIntervalTaken: false,
				changeEndsRequired: false,
				changeEndsCompleted: false
			}
		],
		gamesWon: { A: 0, B: 0 },
		service: null,
		winnerSide: null,
		terminalReason: null,
		lastSeqNo: 3,
		createdAt: '2026-06-20T08:00:00.000Z',
		updatedAt: '2026-06-20T09:00:00.000Z',
		...overrides
	};
}

describe('resolveRealtimeInput', () => {
	test('fills in targetSeqNo for undo before applyMatchAction and notifications use it', () => {
		const input: ScoreEventInput = {
			type: 'undo',
			idempotencyKey: 'undo-1',
			observedSeqNo: 3,
			reason: 'fix'
		};

		const resolved = resolveRealtimeInput(input, 3);

		expect(resolved).toMatchObject({
			type: 'undo',
			targetSeqNo: 3,
			observedSeqNo: 3
		});

		const scoreEvent = buildRealtimeScoreEvent(
			resolved,
			createMatchState(),
			createMatchState({ lastSeqNo: 4 })
		);

		expect(scoreEvent).toMatchObject({
			type: 'undo_applied',
			seqNo: 4,
			targetSeqNo: 3
		});
	});

	test('does not override an explicit undo target', () => {
		const input: ScoreEventInput = {
			type: 'undo',
			idempotencyKey: 'undo-2',
			observedSeqNo: 5,
			targetSeqNo: 2
		};

		expect(resolveRealtimeInput(input, 4)).toBe(input);
	});
});

describe('applyRefereeScorePayload', () => {
	function view(lastSeqNo: number): RefereeLiveView {
		return {
			state: createMatchState({ lastSeqNo }),
			events: []
		};
	}

	function payload(seqNo: number, type = 'rally_won') {
		return {
			state: createMatchState({ lastSeqNo: seqNo }),
			event: { type, seqNo, side: 'A' as const, gameNo: 1, scoreA: 2, scoreB: 0 }
		};
	}

	test('applies a consecutive event and appends it to the log', () => {
		const next = applyRefereeScorePayload(payload(4), view(3));
		expect(next).not.toBe('refresh');
		expect(next).not.toBeNull();
		if (next === 'refresh' || next === null) return;
		expect(next.state.lastSeqNo).toBe(4);
		expect(next.events).toHaveLength(1);
		expect(next.events[0]).toMatchObject({
			seqNo: 4,
			eventType: 'rally_won',
			scoreAAfter: 2,
			scoreBAfter: 0
		});
	});

	test('ignores an already-applied payload (duplicate)', () => {
		expect(applyRefereeScorePayload(payload(3), view(3))).toBeNull();
	});

	test('requests refresh when events were missed (seqNo gap)', () => {
		expect(applyRefereeScorePayload(payload(6), view(3))).toBe('refresh');
	});

	test('requests refresh for match-meta events like winner_confirmed', () => {
		const p = {
			state: createMatchState({ lastSeqNo: 3 }),
			event: { type: 'winner_confirmed' }
		};
		expect(applyRefereeScorePayload(p, view(3))).toBe('refresh');
	});

	test('ignores payloads for another match', () => {
		const p = {
			state: createMatchState({ matchId: 'other-match', lastSeqNo: 4 }),
			event: { type: 'rally_won', seqNo: 4 }
		};
		expect(applyRefereeScorePayload(p, view(3))).toBeNull();
	});
});
