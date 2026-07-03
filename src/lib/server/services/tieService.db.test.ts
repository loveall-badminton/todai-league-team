import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockGetRequestDb = vi.hoisted(() => vi.fn());
const mockEnsureDefaultSettings = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/db/request', () => ({
	getRequestDb: mockGetRequestDb
}));

vi.mock('./tokyoLeagueSetupService', () => ({
	ensureDefaultSettings: mockEnsureDefaultSettings
}));

import { RUBBER_DEFINITIONS } from '$lib/domain/tokyoLeague';
import { createTieWithRubbers, ensureRubbersForTie } from './tieService';

function createInsertChain() {
	return { values: vi.fn(() => undefined) };
}

describe('tieService db helpers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockEnsureDefaultSettings.mockResolvedValue({
			defaultLineupDueMinutesBefore: 10
		});
	});

	test('createTieWithRubbers inserts tie and all rubbers with computed lineup due time', async () => {
		const db = {
			batch: vi.fn(async () => undefined),
			insert: vi.fn(() => createInsertChain()),
			select: vi.fn()
		};
		mockGetRequestDb.mockReturnValue(db);

		const tieId = await createTieWithRubbers({
			tieCode: 'A-1',
			phase: 'group_a',
			groupCode: 'A',
			roundLabel: 'Aリーグ',
			teamAId: 'team-a',
			teamBId: 'team-b',
			scheduledStartAt: '2026-06-20T10:00:00.000Z',
			scoringRuleId: 'GROUP_15',
			now: '2026-06-20T00:00:00.000Z'
		});

		expect(tieId).toBeDefined();
		expect(db.batch).toHaveBeenCalledTimes(1);
		expect(db.insert).toHaveBeenCalledTimes(2);
		const batchCalls = db.batch.mock.calls as unknown as unknown[][];
		expect(batchCalls[0]?.[0]).toHaveLength(2);
		expect(mockEnsureDefaultSettings).toHaveBeenCalled();
	});

	test('ensureRubbersForTie inserts only missing rubbers', async () => {
		let selectCalls = 0;
		const db = {
			batch: vi.fn(),
			insert: vi.fn(() => createInsertChain()),
			select: vi.fn(() => {
				selectCalls += 1;
				return {
					from() {
						if (selectCalls === 1) {
							return { where: vi.fn(async () => [{ count: 3 }]) };
						}
						return {
							where() {
								return {
									orderBy: vi.fn(async () => [
										{ code: RUBBER_DEFINITIONS[0].code },
										{ code: RUBBER_DEFINITIONS[1].code },
										{ code: RUBBER_DEFINITIONS[2].code }
									])
								};
							}
						};
					}
				};
			})
		};
		mockGetRequestDb.mockReturnValue(db);

		await ensureRubbersForTie({
			tieId: 'tie-1',
			scoringRuleId: 'GROUP_15',
			now: '2026-06-20T00:00:00.000Z'
		});

		expect(db.insert).toHaveBeenCalledTimes(1);
	});
});
