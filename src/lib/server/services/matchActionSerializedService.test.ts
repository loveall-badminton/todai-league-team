import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { MatchState, ScoreEventInput } from '$lib/domain/types';

const mockState = vi.hoisted(() => ({
	event: {} as {
		platform?: {
			env?: {
				MatchActionCoordinator?: {
					getByName: (name: string) => {
						fetch: (url: string, init?: RequestInit) => Promise<Response>;
					};
				};
			};
		};
	},
	db: {} as object
}));

const applyMatchActionWithDb = vi.hoisted(() => vi.fn());

vi.mock('$app/server', () => ({
	getRequestEvent: () => mockState.event
}));

vi.mock('$lib/server/db/request', () => ({
	getRequestDb: () => mockState.db
}));

vi.mock('./matchActionService', () => ({
	applyMatchActionWithDb
}));

import { applySerializedMatchAction } from './matchActionSerializedService';

function createMatchState(overrides: Partial<MatchState> = {}): MatchState {
	return {
		schemaVersion: 1,
		matchId: 'match-1',
		tournamentId: 'tournament-1',
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
				score: { A: 1, B: 0 },
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
		lastSeqNo: 1,
		createdAt: '2026-06-26T00:00:00.000Z',
		updatedAt: '2026-06-26T00:00:01.000Z',
		...overrides
	};
}

describe('applySerializedMatchAction', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockState.event = {};
		mockState.db = { tag: 'db' };
	});

	test('falls back to direct DB execution when DO binding is unavailable', async () => {
		const afterState = createMatchState();
		const input: ScoreEventInput = {
			type: 'rally_won',
			side: 'A',
			observedSeqNo: 0,
			idempotencyKey: 'idem-1'
		};
		applyMatchActionWithDb.mockResolvedValue({ afterState, input });

		const result = await applySerializedMatchAction({
			matchId: 'match-1',
			input,
			actorName: null,
			now: '2026-06-26T00:00:01.000Z'
		});

		expect(applyMatchActionWithDb).toHaveBeenCalledWith(mockState.db, {
			matchId: 'match-1',
			input,
			actorName: null,
			now: '2026-06-26T00:00:01.000Z'
		});
		expect(result).toEqual({ afterState, input });
	});

	test('uses the MatchActionCoordinator DO when binding is available', async () => {
		const afterState = createMatchState();
		const input: ScoreEventInput = {
			type: 'rally_won',
			side: 'A',
			observedSeqNo: 0,
			idempotencyKey: 'idem-2'
		};
		const fetch = vi.fn(async () =>
			Response.json({
				ok: true,
				afterState,
				input
			})
		);
		mockState.event = {
			platform: {
				env: {
					MatchActionCoordinator: {
						getByName: () => ({ fetch })
					}
				}
			}
		};

		const result = await applySerializedMatchAction({
			matchId: 'match-1',
			input,
			actorName: 'ref',
			now: '2026-06-26T00:00:01.000Z',
			beforeState: createMatchState({ lastSeqNo: 0 })
		});

		expect(applyMatchActionWithDb).not.toHaveBeenCalled();
		expect(fetch).toHaveBeenCalledTimes(1);
		const init = (fetch.mock.calls[0] as unknown[])?.[1] as RequestInit | undefined;
		expect(JSON.parse(String(init?.body))).toEqual({
			matchId: 'match-1',
			input,
			actorName: 'ref',
			now: '2026-06-26T00:00:01.000Z',
			beforeState: createMatchState({ lastSeqNo: 0 }),
			players: null
		});
		expect(result).toEqual({ afterState, input });
	});

	test('throws coordinator errors back to the caller', async () => {
		const input: ScoreEventInput = {
			type: 'rally_won',
			side: 'A',
			observedSeqNo: 0,
			idempotencyKey: 'idem-3'
		};
		mockState.event = {
			platform: {
				env: {
					MatchActionCoordinator: {
						getByName: () => ({
							fetch: async () => Response.json({ ok: false, error: 'conflict' }, { status: 409 })
						})
					}
				}
			}
		};

		await expect(
			applySerializedMatchAction({
				matchId: 'match-1',
				input,
				now: '2026-06-26T00:00:01.000Z'
			})
		).rejects.toThrow('conflict');
	});
});
