import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockGetRequestDb = vi.hoisted(() => vi.fn());
const mockBatchQuery = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/db/request', () => ({
	getRequestDb: mockGetRequestDb
}));

vi.mock('$lib/server/db/utils', () => ({
	batchQuery: mockBatchQuery
}));

import { getActiveTieBoard, getPublicRubbersForTie } from './liveBoardService';

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
							where() {
								return {
									orderBy: vi.fn(async () => [
										{
											matchId: 'match-1',
											gameNo: 1,
											seqNo: 1,
											scoreA: 21,
											scoreB: 15,
											scoreABefore: 20,
											scoreBBefore: 15,
											side: 'A'
										}
									])
								};
							}
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

	test('getActiveTieBoard returns empty board when no ties are active', async () => {
		const db = {
			select: vi.fn(() => ({
				from() {
					return {
						where() {
							return {
								orderBy: vi.fn(async () => [])
							};
						},
						orderBy: vi.fn(async () => [])
					};
				}
			}))
		};
		mockGetRequestDb.mockReturnValue(db);

		await expect(getActiveTieBoard()).resolves.toEqual({
			ties: [],
			rubbersByTieId: {}
		});
	});
});
