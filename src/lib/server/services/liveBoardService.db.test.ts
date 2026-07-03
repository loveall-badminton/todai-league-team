import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockGetRequestDb = vi.hoisted(() => vi.fn());
const mockBatchQuery = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/db/request', () => ({
	getRequestDb: mockGetRequestDb
}));

vi.mock('$lib/server/db/utils', () => ({
	batchQuery: mockBatchQuery
}));

import { getPublicRubbersForTie } from './liveBoardService';

function createRubberRows() {
	return [
		{
			id: 'rubber-1',
			tieId: 'tie-1',
			code: 'WD1',
			matchId: 'match-1',
			status: 'ready',
			winnerSide: null,
			displayOrder: 1
		}
	];
}

function createMatchRows() {
	return [
		{
			id: 'match-1',
			gamesWonA: 1,
			gamesWonB: 0,
			currentScoreA: 15,
			currentScoreB: 12,
			currentGameNo: 2,
			status: 'playing'
		}
	];
}

function createSnapshotState() {
	return {
		schemaVersion: 1,
		matchId: 'match-1',
		tournamentId: 'tournament-1',
		courtId: null,
		discipline: 'WD',
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
				score: { A: 21, B: 15 },
				winnerSide: 'A',
				midGameIntervalTaken: true,
				changeEndsRequired: false,
				changeEndsCompleted: false
			},
			{
				gameNo: 2,
				score: { A: 15, B: 12 },
				winnerSide: null,
				midGameIntervalTaken: true,
				changeEndsRequired: false,
				changeEndsCompleted: false
			}
		],
		gamesWon: { A: 1, B: 0 },
		winnerSide: null,
		terminalReason: null,
		service: null,
		lastSeqNo: 60,
		createdAt: '2026-06-01T00:00:00.000Z',
		updatedAt: '2026-06-01T01:00:00.000Z'
	};
}

describe('liveBoardService db queries', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('getPublicRubbersForTie loads rubbers, matches, and live game scores', async () => {
		let selectCalls = 0;
		const db = {
			select: vi.fn(() => {
				selectCalls += 1;
				return {
					from() {
						if (selectCalls === 1) {
							return {
								where() {
									return {
										orderBy: vi.fn(async () => createRubberRows())
									};
								}
							};
						}
						if (selectCalls === 2) {
							return {
								where: vi.fn(async () => createMatchRows())
							};
						}
						return {
							where: vi.fn(async () => [
								{
									matchId: 'match-1',
									stateJson: JSON.stringify(createSnapshotState())
								}
							])
						};
					}
				};
			})
		};
		mockGetRequestDb.mockReturnValue(db);
		mockBatchQuery.mockImplementation(
			async (_items: string[], fn: (batch: string[]) => Promise<unknown[]>) => fn(['match-1'])
		);

		const summaries = await getPublicRubbersForTie('tie-1', false);

		expect(summaries[0]).toMatchObject({
			gamesScore: '1-0',
			pointScore: '15-12',
			matchStatus: 'playing'
		});
	});
});
