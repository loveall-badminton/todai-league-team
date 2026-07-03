import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { MatchState, MatchPlayer, ScoreEventInput } from '$lib/domain/types';
import { createInitialMatchState } from '$lib/domain/scoring';

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

const mockRecalculateTieResult = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/services/tieOperationService', () => ({
	recalculateTieResult: mockRecalculateTieResult
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

function buildDb(overrides?: {
	match?: { id: string; rubberId: string };
	rubber?: { id: string; tieId: string };
}) {
	const stmt = { onConflictDoUpdate: vi.fn(() => ({})) };
	const insertChain = { values: vi.fn(() => stmt) };
	const updateChain = { set: vi.fn(() => ({ where: vi.fn(() => ({})) })) };
	return {
		batch: vi.fn(async () => [{}, {}, {}]),
		query: {
			matches: { findFirst: vi.fn(async () => overrides?.match ?? null) },
			rubbers: { findFirst: vi.fn(async () => overrides?.rubber ?? null) }
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

	test('returns cached afterState for duplicate requests', async () => {
		const cachedState = makeState({ A: 2, B: 1 }, 4);
		mockGetScoreEventByIdempotencyKey.mockResolvedValue({
			payloadJson: JSON.stringify({
				input: { type: 'rally_won', side: 'A', observedSeqNo: 3, idempotencyKey: 'ik-1' },
				afterState: cachedState
			})
		});

		const result = await applyMatchActionWithDb(buildDb() as never, {
			matchId: 'match-1',
			input: {
				type: 'rally_won',
				side: 'A',
				observedSeqNo: 3,
				idempotencyKey: 'ik-1'
			},
			beforeState: makeState({ A: 1, B: 1 }, 3),
			players: [],
			now: '2026-01-01T00:00:04.000Z'
		});

		expect(result.afterState.games[0].score).toEqual({ A: 2, B: 1 });
		expect(mockGetScoreEventByIdempotencyKey).toHaveBeenCalledTimes(1);
	});

	test('rejects duplicate requests when stored payload has no afterState', async () => {
		mockGetScoreEventByIdempotencyKey.mockResolvedValue({
			payloadJson: JSON.stringify({
				input: { type: 'rally_won', side: 'A', observedSeqNo: 3, idempotencyKey: 'ik-2' }
			})
		});

		await expect(
			applyMatchActionWithDb(buildDb() as never, {
				matchId: 'match-1',
				input: {
					type: 'rally_won',
					side: 'A',
					observedSeqNo: 3,
					idempotencyKey: 'ik-2'
				},
				beforeState: makeState({ A: 1, B: 1 }, 3),
				players: [],
				now: '2026-01-01T00:00:04.000Z'
			})
		).rejects.toThrow('Duplicate request but afterState is missing from stored payload');
	});

	test('rejects undo when there is no target event', async () => {
		mockGetScoreEventByIdempotencyKey.mockResolvedValue(null);
		mockGetLastUndoableScoreEvent.mockResolvedValue(null);

		await expect(
			applyMatchActionWithDb(buildDb() as never, {
				matchId: 'match-1',
				input: {
					type: 'undo',
					observedSeqNo: 3,
					idempotencyKey: 'ik-undo'
				},
				beforeState: makeState({ A: 1, B: 1 }, 3),
				players: [],
				now: '2026-01-01T00:00:04.000Z'
			})
		).rejects.toThrow('Undo target event not found');
	});
});

describe('applyMatchActionWithDb – tie recalculation triggers', () => {
	beforeEach(() => vi.clearAllMocks());

	const players: MatchPlayer[] = [
		{ id: 'p-a', side: 'A', order: 1, name: 'Player A', teamName: null },
		{ id: 'p-b', side: 'B', order: 1, name: 'Player B', teamName: null }
	];

	test('recalculates the tie when a match starts, even though that is not a terminal transition', async () => {
		const scheduledState = createInitialMatchState({
			matchId: 'match-1',
			tournamentId: 't-1',
			courtId: null,
			discipline: 'MS',
			now: '2026-01-01T00:00:00.000Z'
		});
		const input: ScoreEventInput = {
			type: 'match_started',
			observedSeqNo: 0,
			idempotencyKey: 'ik-start',
			initialServerPlayerId: 'p-a',
			initialReceiverPlayerId: 'p-b'
		};

		mockGetScoreEventByIdempotencyKey.mockResolvedValue(null);
		const db = buildDb({
			match: { id: 'match-1', rubberId: 'rubber-1' },
			rubber: { id: 'rubber-1', tieId: 'tie-1' }
		});

		await applyMatchActionWithDb(db as never, {
			matchId: 'match-1',
			input,
			beforeState: scheduledState,
			players,
			now: '2026-01-01T00:00:05.000Z'
		});

		expect(mockRecalculateTieResult).toHaveBeenCalledWith('tie-1', '2026-01-01T00:00:05.000Z', db);
	});

	test('does not recalculate the tie for a plain rally while the match keeps playing', async () => {
		mockGetScoreEventByIdempotencyKey.mockResolvedValue(null);
		const db = buildDb({
			match: { id: 'match-1', rubberId: 'rubber-1' },
			rubber: { id: 'rubber-1', tieId: 'tie-1' }
		});

		await applyMatchActionWithDb(db as never, {
			matchId: 'match-1',
			input: {
				type: 'rally_won',
				side: 'A',
				observedSeqNo: 1,
				idempotencyKey: 'ik-rally'
			},
			beforeState: makeState({ A: 1, B: 0 }, 1),
			players,
			now: '2026-01-01T00:00:05.000Z'
		});

		expect(mockRecalculateTieResult).not.toHaveBeenCalled();
	});
});
