import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockGetTieWithRubbers = vi.hoisted(() => vi.fn());
const mockListTeams = vi.hoisted(() => vi.fn());
const mockGetOfficiatingAssignment = vi.hoisted(() => vi.fn());
const mockGetTeam = vi.hoisted(() => vi.fn());
const mockGetLineupsForTie = vi.hoisted(() => vi.fn());
const mockListPlayersByIds = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/repositories/tokyoLeagueRepository', () => ({
	getOfficiatingAssignment: mockGetOfficiatingAssignment,
	getTeam: mockGetTeam,
	getTieWithRubbers: mockGetTieWithRubbers,
	listPlayersByIds: mockListPlayersByIds,
	listTeams: mockListTeams
}));

vi.mock('$lib/server/services/lineupService', () => ({
	getLineupsForTie: mockGetLineupsForTie
}));

import { getTieHeaderData, getTieLineupsData } from './tiePageData';

describe('tiePageData', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('getTieHeaderData merges tie, teams, and officiating data', async () => {
		mockGetTieWithRubbers.mockResolvedValue({
			tie: {
				id: 'tie-1',
				tieCode: 'A-1',
				teamAId: 'team-a',
				teamBId: 'team-b'
			},
			rubbers: [{ id: 'rubber-1' }]
		});
		mockListTeams.mockResolvedValue([
			{ id: 'team-a', name: 'Alpha' },
			{ id: 'team-b', name: 'Beta' }
		]);
		mockGetOfficiatingAssignment.mockResolvedValue({
			assignedTeamId: 'team-umpire',
			assignedTeamIds: ['team-umpire'],
			note: 'main court'
		});
		mockGetTeam.mockImplementation(async (teamId: string) =>
			teamId === 'team-a' ? { id: 'team-a', name: 'Alpha' } : { id: 'team-b', name: 'Beta' }
		);

		const result = await getTieHeaderData('tie-1');

		expect(result.tie).toMatchObject({
			id: 'tie-1',
			tieCode: 'A-1',
			officiatingTeamId: 'team-umpire',
			officiatingTeamIds: ['team-umpire'],
			officiatingNote: 'main court'
		});
		expect(result.teams).toEqual([
			{ id: 'team-a', name: 'Alpha' },
			{ id: 'team-b', name: 'Beta' }
		]);
		expect(result.teamA).toEqual({ id: 'team-a', name: 'Alpha' });
		expect(result.teamB).toEqual({ id: 'team-b', name: 'Beta' });
	});

	test('getTieLineupsData gathers players from both sides without duplicates', async () => {
		mockGetLineupsForTie.mockResolvedValue([
			{
				id: 'submission-a',
				items: [
					{ rubberCode: 'WD1', player1Id: 'p1', player2Id: 'p2' },
					{ rubberCode: 'XD1', player1Id: 'p2', player2Id: 'p3' }
				]
			},
			{
				id: 'submission-b',
				items: [{ rubberCode: 'WD1', player1Id: 'p4', player2Id: null }]
			}
		]);
		mockListPlayersByIds.mockResolvedValue([
			{ id: 'p1', name: 'Player 1' },
			{ id: 'p2', name: 'Player 2' },
			{ id: 'p3', name: 'Player 3' },
			{ id: 'p4', name: 'Player 4' }
		]);

		const result = await getTieLineupsData('tie-1');

		expect(mockListPlayersByIds).toHaveBeenCalledWith(['p1', 'p2', 'p3', 'p4']);
		expect(result.tie).toEqual({ id: 'tie-1' });
		expect(result.lineups).toHaveLength(2);
		expect(result.players).toHaveLength(4);
	});
});
