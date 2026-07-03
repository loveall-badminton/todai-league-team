import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockGetRequestDb = vi.hoisted(() => vi.fn());
const mockCalculateAllGroupStandings = vi.hoisted(() => vi.fn());
const mockListTeams = vi.hoisted(() => vi.fn());
const mockListTies = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/db/request', () => ({
	getRequestDb: mockGetRequestDb
}));

vi.mock('$lib/server/services/standingService', () => ({
	calculateAllGroupStandings: mockCalculateAllGroupStandings
}));

vi.mock('$lib/server/repositories/tokyoLeagueRepository', () => ({
	listTeams: mockListTeams,
	listTies: mockListTies
}));

import { getScoreProgressionForTie, getStandingsData } from './livePageService';

type LivePageDb = {
	select: (fields?: object) => {
		from: (table: object) => {
			where: (clause: object) =>
				| Promise<unknown[]>
				| {
						where: (clause: object) =>
							| Promise<unknown[]>
							| {
									orderBy: (
										first: object,
										second: object
									) => {
										limit: (count: number) => Promise<unknown[]>;
									};
							  };
				  };
		};
	};
};

function createSelectChain(result: unknown[], asyncWhere = false) {
	const ordered = Promise.resolve(result);
	const whereChain = {
		where: () =>
			asyncWhere
				? Promise.resolve(result)
				: {
						orderBy: () => ordered
					},
		orderBy: () => ordered
	};
	return {
		from: () => whereChain
	};
}

function createScoreProgressionDb(activeRubbers: unknown[], scoreRows: unknown[]): LivePageDb {
	let callCount = 0;
	return {
		select: () => {
			callCount += 1;
			return createSelectChain(callCount === 1 ? activeRubbers : scoreRows, callCount === 1);
		}
	} as unknown as LivePageDb;
}

describe('livePageService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('getStandingsData maps standings and schedule groups', async () => {
		mockCalculateAllGroupStandings.mockResolvedValue({
			A: [
				{
					teamId: 'team-a',
					teamName: 'Alpha',
					rank: 1,
					teamMatchesWon: 2,
					teamMatchesLost: 0,
					rubbersWon: 10,
					rubbersLost: 1,
					gamesWon: 20,
					gamesLost: 5,
					headToHeadSummary: null,
					tiedTeamsRubbersWon: null,
					tiedTeamsGamesWon: null,
					requiresTiebreaker: false,
					manualRank: null
				}
			],
			B: [
				{
					teamId: 'team-b',
					teamName: 'Beta',
					rank: 2,
					teamMatchesWon: 1,
					teamMatchesLost: 1,
					rubbersWon: 8,
					rubbersLost: 3,
					gamesWon: 16,
					gamesLost: 9,
					headToHeadSummary: null,
					tiedTeamsRubbersWon: null,
					tiedTeamsGamesWon: null,
					requiresTiebreaker: 1,
					manualRank: 3
				}
			]
		});
		mockListTeams.mockResolvedValue([
			{ id: 'team-a', name: 'Alpha' },
			{ id: 'team-b', name: 'Beta' }
		]);
		mockListTies.mockResolvedValue([
			{
				id: 'tie-group',
				tieCode: 'A-1',
				teamAId: 'team-a',
				teamBId: 'team-b',
				winnerTeamId: 'team-a',
				scheduledStartAt: '2026-07-02T10:00:00.000Z',
				lineupDueAt: null,
				teamAName: 'Alpha',
				teamBName: 'Beta',
				status: 'finished',
				teamScoreA: 3,
				teamScoreB: 2,
				phase: 'group_a'
			},
			{
				id: 'tie-final',
				tieCode: 'x-5',
				teamAId: 'team-a',
				teamBId: 'team-b',
				winnerTeamId: null,
				scheduledStartAt: null,
				lineupDueAt: null,
				teamAName: 'Alpha',
				teamBName: 'Beta',
				status: 'scheduled',
				teamScoreA: 0,
				teamScoreB: 0,
				phase: 'final'
			}
		]);

		const result = await getStandingsData();

		expect(result.groupA).toEqual([expect.objectContaining({ id: 'tie-group', phase: 'group_a' })]);
		expect(result.groupB).toEqual([]);
		expect(result.teams).toEqual([
			{ id: 'team-a', name: 'Alpha' },
			{ id: 'team-b', name: 'Beta' }
		]);
		expect(result.finalsTies).toEqual([
			{
				id: 'tie-final',
				tieCode: 'x-5',
				phase: 'final',
				teamAId: 'team-a',
				teamBId: 'team-b',
				teamAName: 'Alpha',
				teamBName: 'Beta',
				winnerTeamId: null,
				status: 'scheduled'
			}
		]);
		expect(result.standingA[0]).toMatchObject({ teamId: 'team-a', requiresTiebreaker: false });
		expect(result.standingB[0]).toMatchObject({ teamId: 'team-b', requiresTiebreaker: true });
	});

	test('getScoreProgressionForTie returns empty maps when no active rubbers exist', async () => {
		mockGetRequestDb.mockReturnValue(createScoreProgressionDb([], []));

		const result = await getScoreProgressionForTie('tie-1');

		expect(result).toEqual({ byMatchId: {}, eventsByMatchId: {} });
	});

	test('getScoreProgressionForTie builds progression by match from active rubbers and events', async () => {
		mockGetRequestDb.mockReturnValue(
			createScoreProgressionDb(
				[{ id: 'rubber-1', matchId: 'match-1' }],
				[
					{
						matchId: 'match-1',
						seqNo: 1,
						eventType: 'rally_won',
						gameNo: 1,
						scoreA: 1,
						scoreB: 0,
						targetSeqNo: null
					},
					{
						matchId: 'match-1',
						seqNo: 2,
						eventType: 'rally_won',
						gameNo: 1,
						scoreA: 1,
						scoreB: 1,
						targetSeqNo: null
					}
				]
			)
		);

		const result = await getScoreProgressionForTie('tie-1');

		expect(result.eventsByMatchId).toEqual({
			'match-1': [
				{
					type: 'rally_won',
					seqNo: 1,
					gameNo: 1,
					scoreA: 1,
					scoreB: 0,
					targetSeqNo: null
				},
				{
					type: 'rally_won',
					seqNo: 2,
					gameNo: 1,
					scoreA: 1,
					scoreB: 1,
					targetSeqNo: null
				}
			]
		});
		expect(result.byMatchId['match-1']).toEqual([
			{ gameNo: 1, scoreA: 1, scoreB: 0 },
			{ gameNo: 1, scoreA: 1, scoreB: 1 }
		]);
	});
});
