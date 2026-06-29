import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { MatchState, ScoreEventInput } from '$lib/domain/types';

vi.mock('$lib/server/db/request', () => ({
	getRequestDb: () => ({})
}));

const mockGetScoreEventByIdempotencyKey = vi.hoisted(() => vi.fn());
const mockGetLastUndoableScoreEvent = vi.hoisted(() => vi.fn());
const mockGetScoreEventBySeqNo = vi.hoisted(() => vi.fn());
const mockHasUndoLink = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/repositories/scoreEventRepository', () => ({
	getScoreEventByIdempotencyKey: mockGetScoreEventByIdempotencyKey,
	getLastUndoableScoreEvent: mockGetLastUndoableScoreEvent,
	getScoreEventBySeqNo: mockGetScoreEventBySeqNo,
	hasUndoLink: mockHasUndoLink
}));

vi.mock('$lib/server/services/tieOperationService', () => ({
	recalculateTieResult: vi.fn()
}));

function makeState(score: { A: number; B: number }, seqNo: number): MatchState {
	return {
		schemaVersion: 1,
		matchId: 'match-1',
		tournamentId: 't-1',
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
		currentGameNo: 1,
		games: [
			{
				gameNo: 1,
				score,
				winnerSide: null,
				midGameIntervalTaken: false,
				changeEndsRequired: false,
				changeEndsCompleted: false
			}
		],
		gamesWon: { A: 0, B: 0 },
		winnerSide: null,
		terminalReason: null,
		service: null,
		lastSeqNo: seqNo,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:01.000Z'
	};
}

function buildDb() {
	const stmt = { onConflictDoUpdate: vi.fn(() => ({})) };
	const insertChain = { values: vi.fn(() => stmt) };
	const updateChain = { set: vi.fn(() => ({ where: vi.fn(() => ({})) })) };
	return {
		batch: vi.fn(async () => [{}, {}, {}]),
		query: {
			matches: { findFirst: vi.fn(async () => null) },
			rubbers: { findFirst: vi.fn(async () => null) }
		},
		insert: vi.fn(() => insertChain),
		update: vi.fn(() => updateChain)
	};
}

import { applyMatchActionWithDb } from './matchActionCore';

describe('applyMatchActionWithDb – undo fallback for rally_won', () => {
	beforeEach(() => vi.clearAllMocks());

	test('reconstructs beforeState from previous event afterState when rally_won payload lacks beforeState', async () => {
		const stateAt0 = makeState({ A: 0, B: 0 }, 1);
		const stateAt1 = makeState({ A: 1, B: 0 }, 2);

		// rally_won at seqNo 2 — no beforeState in payload (old behavior)
		const rallyWonEvent = {
			id: 'ev-2',
			matchId: 'match-1',
			seqNo: 2,
			eventType: 'rally_won' as const,
			payloadJson: JSON.stringify({
				input: { type: 'rally_won', side: 'A', observedSeqNo: 1, idempotencyKey: 'ik-rally' },
				afterState: stateAt1
			}),
			scoreAAfter: 1,
			scoreBAfter: 0,
			idempotencyKey: 'ik-rally',
			createdAt: '2026-01-01T00:00:02.000Z'
		};

		// Previous event (seqNo 1) has afterState = stateAt0
		const prevEvent = {
			id: 'ev-1',
			matchId: 'match-1',
			seqNo: 1,
			eventType: 'match_started' as const,
			payloadJson: JSON.stringify({ afterState: stateAt0 }),
			scoreAAfter: 0,
			scoreBAfter: 0,
			idempotencyKey: 'ik-start',
			createdAt: '2026-01-01T00:00:01.000Z'
		};

		mockGetScoreEventByIdempotencyKey.mockResolvedValue(null);
		mockGetLastUndoableScoreEvent.mockResolvedValue(rallyWonEvent);
		// First call fetches prev event (seqNo 1) for fallback beforeState
		mockGetScoreEventBySeqNo.mockResolvedValue(prevEvent);
		mockHasUndoLink.mockResolvedValue(false);

		const undoInput: ScoreEventInput = {
			type: 'undo',
			observedSeqNo: 2,
			idempotencyKey: 'ik-undo'
		};

		// Provide beforeState/players to skip the snapshot DB fetch
		const result = await applyMatchActionWithDb(buildDb() as never, {
			matchId: 'match-1',
			input: undoInput,
			beforeState: stateAt1,
			players: [],
			now: '2026-01-01T00:00:03.000Z'
		});

		// Undo of rally_won(A at 1→0) should restore score to {A:0,B:0}
		expect(result.afterState.games[0].score).toEqual({ A: 0, B: 0 });
	});
});
