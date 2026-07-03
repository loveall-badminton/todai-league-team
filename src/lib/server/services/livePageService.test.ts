import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockGetRequestDb = vi.hoisted(() => vi.fn());
const mockGetActiveTieBoard = vi.hoisted(() => vi.fn());
const mockGetFinalsTieBoard = vi.hoisted(() => vi.fn());
const mockCalculateAllGroupStandings = vi.hoisted(() => vi.fn());
const mockListTeams = vi.hoisted(() => vi.fn());
const mockListTies = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/db/request', () => ({
	getRequestDb: mockGetRequestDb
}));

vi.mock('$lib/server/services/liveBoardService', () => ({
	getActiveTieBoard: mockGetActiveTieBoard,
	getFinalsTieBoard: mockGetFinalsTieBoard
}));

vi.mock('$lib/server/services/standingService', () => ({
	calculateAllGroupStandings: mockCalculateAllGroupStandings
}));

vi.mock('$lib/server/repositories/tokyoLeagueRepository', () => ({
	listTeams: mockListTeams,
	listTies: mockListTies
}));

import { getLivePageData, getScoreProgressionForTie, getStandingsData } from './livePageService';

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

	test('getLivePageData maps schedule, finals, standings, and active ties', async () => {
		mockGetActiveTieBoard.mockResolvedValue({
			ties: [
				{
					id: 'tie-active',
					phase: 'group_a',
					tieCode: 'A-1',
					venue: 'first_gym',
					courtBlockCode: 'first_1_3',
					teamAName: 'Alpha',
					teamBName: 'Beta',
					teamScoreA: 2,
					teamScoreB: 1,
					teamAId: 'team-a',
					teamBId: 'team-b',
					status: 'playing'
				}
			],
			rubbersByTieId: {
				'tie-active': [
					{
						id: 'rubber-1',
						code: 'WD1',
						matchId: 'match-1',
						status: 'playing',
						matchStatus: 'playing',
						winnerSide: null,
						sideAPlayers: 'A One / A Two',
						sideBPlayers: 'B One / B Two',
						gamesScore: '1-0',
						pointScore: '15-12',
						gameDetails: [
							{ gameNo: 1, scoreA: 21, scoreB: 15, winnerSide: 'A' },
							{ gameNo: 2, scoreA: 15, scoreB: 12, winnerSide: null }
						]
					}
				]
			}
		});
		mockGetFinalsTieBoard.mockResolvedValue({
			finalsBoard: [
				{
					id: 'tie-final',
					phase: 'final',
					teamAName: 'Alpha',
					teamBName: 'Gamma',
					teamScoreA: 3,
					teamScoreB: 2,
					status: 'finished'
				}
			]
		});
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
					requiresTiebreaker: 0,
					manualRank: null
				}
			],
			B: []
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
				lineupDueAt: '2026-07-02T09:50:00.000Z',
				teamAName: 'Alpha',
				teamBName: 'Beta',
				status: 'finished',
				teamScoreA: 3,
				teamScoreB: 2,
				phase: 'group_a'
			},
			{
				id: 'tie-third',
				tieCode: 'x-4',
				teamAId: 'team-b',
				teamBId: 'team-a',
				winnerTeamId: null,
				scheduledStartAt: null,
				lineupDueAt: null,
				teamAName: 'Beta',
				teamBName: 'Alpha',
				status: 'scheduled',
				teamScoreA: 0,
				teamScoreB: 0,
				phase: 'third_place'
			}
		]);

		const result = await getLivePageData();

		expect(result.schedule).toHaveLength(2);
		expect(result.standings.groupA).toHaveLength(1);
		expect(result.standings.groupB).toHaveLength(0);
		expect(result.standings.teams).toEqual([
			{ id: 'team-a', name: 'Alpha' },
			{ id: 'team-b', name: 'Beta' }
		]);
		expect(result.standings.finalsTies).toEqual([
			{
				id: 'tie-third',
				tieCode: 'x-4',
				phase: 'third_place',
				teamAId: 'team-b',
				teamBId: 'team-a',
				teamAName: 'Beta',
				teamBName: 'Alpha',
				winnerTeamId: null,
				status: 'scheduled'
			}
		]);
		expect(result.activeTies.ties[0]).toMatchObject({
			id: 'tie-active',
			phase: 'group_a',
			status: 'playing',
			teamScoreA: 2,
			teamScoreB: 1
		});
		expect(result.activeTies.rubbersByTieId['tie-active'][0].gameDetails[1].winnerSide).toBeNull();
		expect(result.finalsBoard.finalsBoard).toEqual([
			{
				id: 'tie-final',
				phase: 'final',
				teamAName: 'Alpha',
				teamBName: 'Gamma',
				teamScoreA: 3,
				teamScoreB: 2,
				status: 'finished'
			}
		]);
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
