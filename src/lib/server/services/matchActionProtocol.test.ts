import { describe, expect, test } from 'vitest';
import * as v from 'valibot';
import {
	MATCH_ACTION_COORDINATOR_URL,
	MatchActionCoordinatorErrorSchema,
	MatchActionCoordinatorRequestSchema,
	MatchActionCoordinatorResponseSchema,
	MatchActionCoordinatorSuccessSchema
} from './matchActionProtocol';

describe('matchActionProtocol', () => {
	test('exposes the coordinator endpoint url', () => {
		expect(MATCH_ACTION_COORDINATOR_URL).toBe('https://match-action.internal/apply');
	});

	test('accepts a valid request payload', () => {
		const result = v.safeParse(MatchActionCoordinatorRequestSchema, {
			matchId: 'match-1',
			input: {
				type: 'undo',
				idempotencyKey: 'idem-1',
				observedSeqNo: 5,
				targetSeqNo: 3
			},
			actorName: null,
			now: '2026-07-02T00:00:00.000Z',
			beforeState: null,
			players: [
				{
					id: 'p1',
					name: 'Player 1',
					side: 'A',
					order: 1,
					teamName: 'Team A'
				}
			]
		});

		expect(result.success).toBe(true);
	});

	test('rejects invalid player side values in request payloads', () => {
		const result = v.safeParse(MatchActionCoordinatorRequestSchema, {
			matchId: 'match-1',
			input: {
				type: 'match_confirmed',
				idempotencyKey: 'idem-2',
				observedSeqNo: 5
			},
			now: '2026-07-02T00:00:00.000Z',
			players: [
				{
					id: 'p1',
					name: 'Player 1',
					side: 'C',
					order: 1,
					teamName: null
				}
			]
		});

		expect(result.success).toBe(false);
	});

	test('accepts both success and error response shapes', () => {
		expect(
			v.safeParse(MatchActionCoordinatorResponseSchema, {
				ok: true,
				afterState: {
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
							score: { A: 0, B: 0 },
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
					lastSeqNo: 0,
					createdAt: '2026-07-02T00:00:00.000Z',
					updatedAt: '2026-07-02T00:00:00.000Z'
				},
				input: {
					type: 'match_confirmed',
					idempotencyKey: 'idem-3',
					observedSeqNo: 5
				}
			}).success
		).toBe(true);

		expect(
			v.safeParse(MatchActionCoordinatorResponseSchema, {
				ok: false,
				error: 'conflict'
			}).success
		).toBe(true);
	});

	test('rejects malformed error responses', () => {
		expect(
			v.safeParse(MatchActionCoordinatorErrorSchema, {
				ok: false,
				error: 123
			}).success
		).toBe(false);

		expect(
			v.safeParse(MatchActionCoordinatorSuccessSchema, {
				ok: true,
				afterState: null,
				input: {
					type: 'match_confirmed',
					idempotencyKey: 'idem-4',
					observedSeqNo: 5
				}
			}).success
		).toBe(false);
	});
});
