import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockGetRequestDb = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/db/request', () => ({
	getRequestDb: mockGetRequestDb
}));

import { tournaments } from '$lib/server/db/schema';
import {
	ensureDefaultSettings,
	ensureInternalTournament,
	getCachedAppSettings,
	invalidateAppSettingsCache,
	scoringConfigFromRule
} from './tokyoLeagueSetupService';

function createDbMock() {
	const insertChain = { values: vi.fn(async () => undefined) };
	return {
		query: {
			scoringRules: { findFirst: vi.fn() },
			appSettings: { findFirst: vi.fn() },
			tournaments: { findFirst: vi.fn() }
		},
		select: vi.fn(() => ({
			from: vi.fn(() => ({ where: vi.fn(async (): Promise<{ code: string }[]> => []) }))
		})),
		insert: vi.fn(() => insertChain)
	};
}

describe('tokyoLeagueSetupService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		invalidateAppSettingsCache();
	});

	test('scoringConfigFromRule maps rule fields without extra properties', () => {
		expect(
			scoringConfigFromRule({
				id: 'rule-1',
				code: 'GROUP_15',
				name: 'Group',
				maxGames: 3,
				gamesToWin: 2,
				pointsToWin: 15,
				winBy: 2,
				maxPoints: 21,
				midGameIntervalPoint: 8,
				createdAt: '2026-06-20T00:00:00.000Z',
				updatedAt: '2026-06-20T00:00:00.000Z'
			})
		).toEqual({
			maxGames: 3,
			gamesToWin: 2,
			pointsToWin: 15,
			winBy: 2,
			maxPoints: 21,
			midGameIntervalPoint: 8
		});
	});

	test('ensureDefaultSettings inserts default scoring rules and settings when absent', async () => {
		const db = createDbMock();
		db.query.appSettings.findFirst.mockResolvedValueOnce(null);
		mockGetRequestDb.mockReturnValue(db);

		const result = await ensureDefaultSettings('2026-06-20T00:00:00.000Z');

		expect(result).toMatchObject({
			id: 'default',
			eventName: '東大リーグ団体戦',
			groupStageScoringRuleId: 'GROUP_15'
		});
		expect(db.select).toHaveBeenCalled();
		expect(db.insert).toHaveBeenCalled();
		expect(db.query.appSettings.findFirst).toHaveBeenCalledWith({
			where: expect.anything()
		});
	});

	test('ensureDefaultSettings returns existing settings without reinserting', async () => {
		const db = createDbMock();
		const codes = [
			'GROUP_15',
			'KNOCKOUT_21',
			'TIEBREAKER_21_SINGLE_GAME',
			'TIEBREAKER_15_SINGLE_GAME',
			'QUALIFIER_15'
		];
		const whereFn = vi.fn(async () => codes.map((c) => ({ code: c })));
		db.select.mockReturnValue({ from: vi.fn(() => ({ where: whereFn })) });
		db.query.appSettings.findFirst.mockResolvedValue({
			id: 'default',
			eventName: 'existing'
		});
		mockGetRequestDb.mockReturnValue(db);

		const result = await ensureDefaultSettings('2026-06-20T00:00:00.000Z');

		expect(result).toMatchObject({ id: 'default', eventName: 'existing' });
		expect(db.insert).not.toHaveBeenCalled();
	});

	test('getCachedAppSettings reuses the result across calls without re-querying the DB', async () => {
		const db = createDbMock();
		db.query.appSettings.findFirst.mockResolvedValue({ id: 'default', eventName: 'cached-me' });
		mockGetRequestDb.mockReturnValue(db);

		const first = await getCachedAppSettings('2026-06-20T00:00:00.000Z');
		const second = await getCachedAppSettings('2026-06-20T00:00:00.000Z');

		expect(first).toMatchObject({ eventName: 'cached-me' });
		expect(second).toBe(first);
		expect(db.query.appSettings.findFirst).toHaveBeenCalledTimes(1);
	});

	test('invalidateAppSettingsCache forces the next call to re-query the DB', async () => {
		const db = createDbMock();
		db.query.appSettings.findFirst.mockResolvedValue({ id: 'default', eventName: 'v1' });
		mockGetRequestDb.mockReturnValue(db);

		await getCachedAppSettings('2026-06-20T00:00:00.000Z');
		invalidateAppSettingsCache();
		db.query.appSettings.findFirst.mockResolvedValue({ id: 'default', eventName: 'v2' });
		const result = await getCachedAppSettings('2026-06-20T00:00:00.000Z');

		expect(result).toMatchObject({ eventName: 'v2' });
		expect(db.query.appSettings.findFirst).toHaveBeenCalledTimes(2);
	});

	test('ensureInternalTournament inserts only when absent', async () => {
		const db = createDbMock();
		db.query.tournaments.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
			id: 'tokyo-league-default'
		});
		mockGetRequestDb.mockReturnValue(db);

		await ensureInternalTournament('2026-06-20T00:00:00.000Z');
		await ensureInternalTournament('2026-06-20T00:00:00.000Z');

		expect(db.insert).toHaveBeenCalledTimes(1);
		expect(db.query.tournaments.findFirst).toHaveBeenCalled();
		expect(db.insert).toHaveBeenCalledWith(tournaments);
	});
});
