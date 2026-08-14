import { describe, expect, test } from 'vitest';
import { buildRealtimeScoreEvent, resolveRealtimeInput } from './matchScorePayload';
import type { MatchState, ScoreEventInput } from '$lib/domain/types';

function state(overrides: Partial<MatchState> = {}): MatchState {
	return {
		schemaVersion: 1,
		matchId: 'm1',
		tournamentId: 't1',
		courtId: null,
		discipline: 'MS',
		status: 'playing',
		scoring: {
			maxGames: 3,
			gamesToWin: 2,
			pointsToWin: 21,
			winBy: 2,
			maxPoints: 30,
			midGameIntervalPoint: 11
		},
		currentGameNo: 2,
		games: [
			{
				gameNo: 1,
				score: { A: 21, B: 0 },
				winnerSide: 'A',
				midGameIntervalTaken: true,
				changeEndsRequired: false,
				changeEndsCompleted: false
			},
			{
				gameNo: 2,
				score: { A: 5, B: 3 },
				winnerSide: null,
				midGameIntervalTaken: false,
				changeEndsRequired: false,
				changeEndsCompleted: false
			}
		],
		gamesWon: { A: 1, B: 0 },
		winnerSide: null,
		terminalReason: null,
		service: {
			discipline: 'singles',
			servingSide: 'A',
			serviceCourt: 'right',
			serverPlayerId: 'a1',
			receiverPlayerId: 'b1'
		},
		lastSeqNo: 3,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		...overrides
	};
}

describe('resolveRealtimeInput', () => {
	test('returns non-undo input unchanged', () => {
		const input: ScoreEventInput = {
			type: 'rally_won',
			side: 'A',
			idempotencyKey: 'r1',
			observedSeqNo: 1
		};
		expect(resolveRealtimeInput(input)).toBe(input);
	});

	test('returns undo with explicit targetSeqNo unchanged', () => {
		const input: ScoreEventInput = {
			type: 'undo',
			targetSeqNo: 5,
			idempotencyKey: 'u1',
			observedSeqNo: 1
		};
		expect(resolveRealtimeInput(input)).toBe(input);
	});

	test('fills missing targetSeqNo from lastUndoableSeqNo', () => {
		const input: ScoreEventInput = { type: 'undo', idempotencyKey: 'u1', observedSeqNo: 1 };
		const resolved = resolveRealtimeInput(input, 5);
		expect(resolved).toEqual({
			type: 'undo',
			targetSeqNo: 5,
			idempotencyKey: 'u1',
			observedSeqNo: 1
		});
	});

	test('does not fill targetSeqNo when lastUndoableSeqNo is undefined', () => {
		const input: ScoreEventInput = { type: 'undo', idempotencyKey: 'u1', observedSeqNo: 1 };
		const resolved = resolveRealtimeInput(input);
		expect(resolved).toBe(input);
	});
});

describe('buildRealtimeScoreEvent', () => {
	test('uses current game number when input has no gameNo', () => {
		const input: ScoreEventInput = {
			type: 'rally_won',
			side: 'A',
			idempotencyKey: 'r1',
			observedSeqNo: 1
		};
		const event = buildRealtimeScoreEvent(input, state(), state());
		expect(event).toBeDefined();
		if (!event) throw new Error('Expected score event');
		expect(event.gameNo).toBe(2);
		expect(event.scoreA).toBe(5);
		expect(event.scoreB).toBe(3);
	});

	test('omits side when input has no side property', () => {
		const input: ScoreEventInput = {
			type: 'undo',
			idempotencyKey: 'u1',
			observedSeqNo: 1,
			targetSeqNo: 2
		};
		const event = buildRealtimeScoreEvent(input, state(), state());
		expect(event).toBeDefined();
		if (!event) throw new Error('Expected score event');
		expect(event).not.toHaveProperty('side');
		expect(event.type).toBe('undo_applied');
	});

	test('omits targetSeqNo when undo input has no targetSeqNo', () => {
		const input: ScoreEventInput = { type: 'undo', idempotencyKey: 'u1', observedSeqNo: 1 };
		const event = buildRealtimeScoreEvent(input, state(), state());
		expect(event).toBeDefined();
		if (!event) throw new Error('Expected score event');
		expect(event).not.toHaveProperty('targetSeqNo');
	});

	test('uses input gameNo when present', () => {
		const input: ScoreEventInput = {
			type: 'correction',
			idempotencyKey: 'c1',
			observedSeqNo: 1,
			gameNo: 1,
			score: { A: 20, B: 0 },
			reason: 'test'
		};
		const event = buildRealtimeScoreEvent(input, state(), state());
		expect(event).toBeDefined();
		if (!event) throw new Error('Expected score event');
		expect(event.gameNo).toBe(1);
		expect(event.scoreA).toBe(21);
		expect(event.scoreB).toBe(0);
	});
});
