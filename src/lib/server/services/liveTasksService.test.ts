import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockGetBatchedPublicRubbers = vi.hoisted(() => vi.fn());
const mockListOfficiatingTieIds = vi.hoisted(() => vi.fn());
const mockListTeams = vi.hoisted(() => vi.fn());
const mockListTiesByIds = vi.hoisted(() => vi.fn());
const mockListTiesForTeam = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/services/liveBoardService', () => ({
	getBatchedPublicRubbers: mockGetBatchedPublicRubbers
}));

vi.mock('$lib/server/repositories/tokyoLeagueRepository', () => ({
	listOfficiatingTieIds: mockListOfficiatingTieIds,
	listTeams: mockListTeams,
	listTiesByIds: mockListTiesByIds,
	listTiesForTeam: mockListTiesForTeam
}));

vi.mock('$lib/server/db/request', () => ({
	getRequestDb: () => {
		throw new Error('getRequestDb should not be called in these tests');
	}
}));

import { loadLiveTasksPageData } from './liveTasksService';

describe('loadLiveTasksPageData', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('returns empty data for non-team profiles', async () => {
		const result = await loadLiveTasksPageData({ accountType: 'admin', teamId: null } as never);

		expect(result).toEqual({
			myTies: [],
			myOfficiatingTies: [],
			publicRubbersByTieId: {}
		});
		expect(mockListTeams).not.toHaveBeenCalled();
		expect(mockGetBatchedPublicRubbers).not.toHaveBeenCalled();
	});

	test('loads team tasks, filters cancelled ties, and deduplicates public rubbers lookup', async () => {
		mockListTeams.mockResolvedValue([
			{ id: 'team-a', name: 'Team A' },
			{ id: 'team-b', name: 'Team B' },
			{ id: 'team-c', name: 'Team C' }
		]);
		mockListTiesForTeam.mockResolvedValue([
			{
				id: 'tie-1',
				tieCode: 'G1-1',
				status: 'playing',
				teamAId: 'team-a',
				teamBId: 'team-b',
				scheduledStartAt: '2026-07-02T10:00:00.000Z',
				lineupDueAt: null
			},
			{
				id: 'tie-2',
				tieCode: 'G1-2',
				status: 'cancelled',
				teamAId: 'team-a',
				teamBId: null,
				scheduledStartAt: null,
				lineupDueAt: null
			}
		]);
		mockListOfficiatingTieIds.mockResolvedValue(['tie-1', 'tie-3']);
		mockListTiesByIds.mockResolvedValue([
			{
				id: 'tie-1',
				tieCode: 'G1-1',
				status: 'playing',
				teamAId: 'team-a',
				teamBId: 'team-b',
				scheduledStartAt: '2026-07-02T10:00:00.000Z',
				lineupDueAt: null
			},
			{
				id: 'tie-3',
				tieCode: 'G2-1',
				status: 'finished',
				teamAId: 'team-b',
				teamBId: 'team-c',
				scheduledStartAt: '2026-07-02T12:00:00.000Z',
				lineupDueAt: '2026-07-02T11:30:00.000Z'
			}
		]);
		mockGetBatchedPublicRubbers.mockResolvedValue([
			[{ tieId: 'tie-1', rubberCode: 'WD1' }],
			[{ tieId: 'tie-3', rubberCode: 'MD1' }]
		]);

		const result = await loadLiveTasksPageData({ accountType: 'team', teamId: 'team-a' } as never);

		expect(mockListTeams).toHaveBeenCalledTimes(1);
		expect(mockListTiesForTeam).toHaveBeenCalledWith('team-a');
		expect(mockListOfficiatingTieIds).toHaveBeenCalledWith('team-a');
		expect(mockListTiesByIds).toHaveBeenCalledWith(['tie-1', 'tie-3']);
		expect(mockGetBatchedPublicRubbers).toHaveBeenCalledWith(['tie-1', 'tie-3'], {
			revealed: false
		});
		expect(result).toEqual({
			myTies: [
				{
					id: 'tie-1',
					tieCode: 'G1-1',
					status: 'playing',
					teamAName: 'Team A',
					teamBName: 'Team B',
					scheduledStartAt: '2026-07-02T10:00:00.000Z',
					lineupDueAt: null
				}
			],
			myOfficiatingTies: [
				{
					id: 'tie-1',
					tieCode: 'G1-1',
					status: 'playing',
					teamAName: 'Team A',
					teamBName: 'Team B',
					scheduledStartAt: '2026-07-02T10:00:00.000Z',
					lineupDueAt: null
				},
				{
					id: 'tie-3',
					tieCode: 'G2-1',
					status: 'finished',
					teamAName: 'Team B',
					teamBName: 'Team C',
					scheduledStartAt: '2026-07-02T12:00:00.000Z',
					lineupDueAt: '2026-07-02T11:30:00.000Z'
				}
			],
			publicRubbersByTieId: {
				'tie-1': [{ tieId: 'tie-1', rubberCode: 'WD1' }],
				'tie-3': [{ tieId: 'tie-3', rubberCode: 'MD1' }]
			}
		});
	});
});
