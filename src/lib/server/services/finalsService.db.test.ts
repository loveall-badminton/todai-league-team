import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockGetRequestDb = vi.hoisted(() => vi.fn());
const mockEnsureDefaultSettings = vi.hoisted(() => vi.fn());
const mockCreateTieWithRubbers = vi.hoisted(() => vi.fn());
const mockEnsureRubbersForTie = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/db/request', () => ({
	getRequestDb: mockGetRequestDb
}));

vi.mock('./tokyoLeagueSetupService', () => ({
	ensureDefaultSettings: mockEnsureDefaultSettings
}));

vi.mock('./tieService', () => ({
	createTieWithRubbers: mockCreateTieWithRubbers,
	ensureRubbersForTie: mockEnsureRubbersForTie
}));

import {
	generateFifthPlace,
	generateFinalAndThirdPlace,
	generateSemifinals
} from './finalsService';

function dbWithGroupTies() {
	return {
		query: {
			ties: {
				findFirst: vi.fn().mockResolvedValue(null),
				findMany: vi.fn().mockResolvedValue([])
			},
			teams: {
				findFirst: vi.fn().mockResolvedValue({ id: 'team' }),
				findMany: vi
					.fn()
					.mockResolvedValue(['a1', 'a2', 'a3', 'b1', 'b2', 'b3'].map((id) => ({ id })))
			}
		}
	};
}

describe('finalsService db generation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockEnsureDefaultSettings.mockResolvedValue({ knockoutScoringRuleId: 'KNOCKOUT_21' });
		mockCreateTieWithRubbers.mockResolvedValue('tie-created');
		mockEnsureRubbersForTie.mockResolvedValue(undefined);
	});

	test('generateSemifinals creates two ties from manual assignments', async () => {
		mockGetRequestDb.mockReturnValue(dbWithGroupTies());

		await expect(
			generateSemifinals(
				{
					x1TeamAId: 'a1',
					x1TeamBId: 'b2',
					x2TeamAId: 'a2',
					x2TeamBId: 'b1'
				},
				'2026-06-20T00:00:00.000Z'
			)
		).resolves.toBe(2);
		expect(mockCreateTieWithRubbers).toHaveBeenCalledTimes(2);
		expect(mockEnsureDefaultSettings).toHaveBeenCalled();
	});

	test('generateFifthPlace creates one tie from manual assignments', async () => {
		mockGetRequestDb.mockReturnValue(dbWithGroupTies());

		await expect(
			generateFifthPlace(
				{
					x3TeamAId: 'a3',
					x3TeamBId: 'b3'
				},
				'2026-06-20T00:00:00.000Z'
			)
		).resolves.toBe(1);
		expect(mockCreateTieWithRubbers).toHaveBeenCalledTimes(1);
	});

	test('generateSemifinals throws when assignments are incomplete', async () => {
		mockGetRequestDb.mockReturnValue(dbWithGroupTies());

		await expect(
			generateSemifinals(
				{
					x1TeamAId: 'a1',
					x1TeamBId: '',
					x2TeamAId: 'a2',
					x2TeamBId: 'b1'
				},
				'2026-06-20T00:00:00.000Z'
			)
		).rejects.toThrow('出場チームをすべて選択してください');
	});

	test('generateFinalAndThirdPlace creates or updates finals from semifinal results', async () => {
		const db = {
			query: {
				ties: {
					findFirst: vi
						.fn()
						.mockResolvedValueOnce({
							tieCode: 'X-1',
							status: 'finished',
							teamAId: 'a1',
							teamBId: 'b2',
							winnerTeamId: 'a1'
						})
						.mockResolvedValueOnce({
							tieCode: 'X-2',
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
