import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockGetRequestDb = vi.hoisted(() => vi.fn());
const mockEnsureDefaultSettings = vi.hoisted(() => vi.fn());
const mockCalculateGroupStandings = vi.hoisted(() => vi.fn());
const mockCreateTieWithRubbers = vi.hoisted(() => vi.fn());
const mockEnsureRubbersForTie = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/db/request', () => ({
	getRequestDb: mockGetRequestDb
}));

vi.mock('./tokyoLeagueSetupService', () => ({
	ensureDefaultSettings: mockEnsureDefaultSettings
}));

vi.mock('./standingService', () => ({
	calculateGroupStandings: mockCalculateGroupStandings
}));

vi.mock('./tieService', () => ({
	createTieWithRubbers: mockCreateTieWithRubbers,
	ensureRubbersForTie: mockEnsureRubbersForTie
}));

import { generateFinalAndThirdPlace, generateSemifinalsAndFifthPlace } from './finalsService';

describe('finalsService db generation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockEnsureDefaultSettings.mockResolvedValue({ knockoutScoringRuleId: 'KNOCKOUT_21' });
		mockCreateTieWithRubbers.mockResolvedValue('tie-created');
		mockEnsureRubbersForTie.mockResolvedValue(undefined);
	});

	test('generateSemifinalsAndFifthPlace creates three ties when assignments are ready', async () => {
		const db = {
			query: {
				ties: {
					findFirst: vi.fn().mockResolvedValue(null)
				}
			}
		};
		mockGetRequestDb.mockReturnValue(db);
		mockCalculateGroupStandings.mockResolvedValueOnce([
			{ rank: 1, teamId: 'a1' },
			{ rank: 2, teamId: 'a2' },
			{ rank: 3, teamId: 'a3' }
		]);
		mockCalculateGroupStandings.mockResolvedValueOnce([
			{ rank: 1, teamId: 'b1' },
			{ rank: 2, teamId: 'b2' },
			{ rank: 3, teamId: 'b3' }
		]);

		await expect(generateSemifinalsAndFifthPlace('2026-06-20T00:00:00.000Z')).resolves.toBe(3);
		expect(mockCreateTieWithRubbers).toHaveBeenCalledTimes(3);
		expect(mockEnsureDefaultSettings).toHaveBeenCalled();
	});

	test('generateSemifinalsAndFifthPlace throws when assignments are incomplete', async () => {
		mockCalculateGroupStandings.mockResolvedValueOnce([
			{ rank: 1, teamId: 'a1', requiresTiebreaker: true }
		]);
		mockCalculateGroupStandings.mockResolvedValueOnce([{ rank: 1, teamId: 'b1' }]);

		await expect(generateSemifinalsAndFifthPlace('2026-06-20T00:00:00.000Z')).rejects.toThrow(
			'予選順位を確定してから生成してください'
		);
	});

	test('generateFinalAndThirdPlace creates or updates finals from semifinal results', async () => {
		const db = {
			query: {
				ties: {
					findFirst: vi
						.fn()
						.mockResolvedValueOnce({
							tieCode: 'x-1',
							status: 'finished',
							teamAId: 'a1',
							teamBId: 'b2',
							winnerTeamId: 'a1'
						})
						.mockResolvedValueOnce({
							tieCode: 'x-2',
							status: 'confirmed',
							teamAId: 'a2',
							teamBId: 'b1',
							winnerTeamId: 'b1'
						})
				}
			}
		};
		mockGetRequestDb.mockReturnValue(db);

		await expect(generateFinalAndThirdPlace('2026-06-20T00:00:00.000Z')).resolves.toBe(2);
		expect(mockCreateTieWithRubbers).toHaveBeenCalledTimes(2);
	});

	test('generateFinalAndThirdPlace requires both semifinal ties', async () => {
		const db = {
			query: {
				ties: {
					findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null)
				}
			}
		};
		mockGetRequestDb.mockReturnValue(db);

		await expect(generateFinalAndThirdPlace('2026-06-20T00:00:00.000Z')).rejects.toThrow(
			'準決勝を先に生成してください'
		);
	});
});
