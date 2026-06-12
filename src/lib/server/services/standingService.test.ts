import { describe, expect, test } from 'vitest';
import { calculateGroupStandingsFromRecords } from './standingService';

const teams = [
	{ id: 'a', name: 'Alpha' },
	{ id: 'b', name: 'Beta' },
	{ id: 'c', name: 'Gamma' }
];

describe('calculateGroupStandingsFromRecords', () => {
	test('orders two tied teams by head-to-head result', () => {
		const standings = calculateGroupStandingsFromRecords({
			teams,
			ties: [
				{ id: 'ab', teamAId: 'a', teamBId: 'b', winnerTeamId: 'b' },
				{ id: 'ac', teamAId: 'a', teamBId: 'c', winnerTeamId: 'a' },
				{ id: 'bc', teamAId: 'b', teamBId: 'c', winnerTeamId: null }
			],
			rubbers: [],
			matches: []
		});

		expect(standings.map((row) => [row.teamId, row.rank, row.headToHeadSummary])).toEqual([
			['b', 1, '直接対決勝利'],
			['a', 2, '直接対決敗戦'],
			['c', 3, null]
		]);
	});

	test('uses manual rank before calculated order', () => {
		const standings = calculateGroupStandingsFromRecords({
			teams,
			ties: [
				{ id: 'ab', teamAId: 'a', teamBId: 'b', winnerTeamId: 'a' },
				{ id: 'ac', teamAId: 'a', teamBId: 'c', winnerTeamId: 'a' }
			],
			rubbers: [],
			matches: [],
			overrides: [{ teamId: 'c', manualRank: 1 }]
		});

		expect(standings[0]).toMatchObject({ teamId: 'c', rank: 1, manualRank: 1 });
	});

	test('does not require a tiebreaker before all round-robin ties are complete', () => {
		const standings = calculateGroupStandingsFromRecords({
			teams: teams.slice(0, 2),
			ties: [],
			rubbers: [],
			matches: []
		});

		expect(standings).toEqual([
			expect.objectContaining({ teamId: 'a', rank: 1, requiresTiebreaker: false }),
			expect.objectContaining({ teamId: 'b', rank: 2, requiresTiebreaker: false })
		]);
	});

	test('uses rubber and game wins after team match wins and head-to-head', () => {
		const standings = calculateGroupStandingsFromRecords({
			teams: teams.slice(1),
			ties: [{ id: 'bc', teamAId: 'b', teamBId: 'c', winnerTeamId: null }],
			rubbers: [
				{ id: 'r2', tieId: 'bc', matchId: 'm2', winnerSide: 'A' },
				{ id: 'r3', tieId: 'bc', matchId: 'm3', winnerSide: 'B' }
			],
			matches: [
				{ id: 'm2', gamesWonA: 2, gamesWonB: 1 },
				{ id: 'm3', gamesWonA: 0, gamesWonB: 2 }
			]
		});

		expect(standings.map((row) => row.teamId)).toEqual(['c', 'b']);
		expect(standings[0].gamesWon).toBeGreaterThan(standings[1].gamesWon);
	});

	test('rubber-wins tiebreaker separates teams with equal match wins and no head-to-head result', () => {
		const standings = calculateGroupStandingsFromRecords({
			teams: teams.slice(0, 2),
			ties: [{ id: 'ab', teamAId: 'a', teamBId: 'b', winnerTeamId: null }],
			rubbers: [
				{ id: 'r1', tieId: 'ab', matchId: null, winnerSide: 'A' },
				{ id: 'r2', tieId: 'ab', matchId: null, winnerSide: 'A' },
				{ id: 'r3', tieId: 'ab', matchId: null, winnerSide: 'B' }
			],
			matches: []
		});

		expect(standings[0].teamId).toBe('a');
		expect(standings[0].rubbersWon).toBe(2);
		expect(standings[1].rubbersWon).toBe(1);
	});

	test('game-wins tiebreaker separates teams with equal match wins and equal rubber wins', () => {
		const standings = calculateGroupStandingsFromRecords({
			teams: teams.slice(0, 2),
			ties: [{ id: 'ab', teamAId: 'a', teamBId: 'b', winnerTeamId: null }],
			rubbers: [
				{ id: 'r1', tieId: 'ab', matchId: 'm1', winnerSide: 'A' },
				{ id: 'r2', tieId: 'ab', matchId: 'm2', winnerSide: 'B' }
			],
			matches: [
				{ id: 'm1', gamesWonA: 2, gamesWonB: 0 },
				{ id: 'm2', gamesWonA: 1, gamesWonB: 2 }
			]
		});

		expect(standings[0].teamId).toBe('a');
		expect(standings[0].gamesWon).toBeGreaterThan(standings[1].gamesWon);
	});

	test('3-way tie with equal match wins uses tiedTeamsRubbersWon to distinguish ranks', () => {
		const standings = calculateGroupStandingsFromRecords({
			teams,
			ties: [
				{ id: 'ab', teamAId: 'a', teamBId: 'b', winnerTeamId: null },
				{ id: 'ac', teamAId: 'a', teamBId: 'c', winnerTeamId: null },
				{ id: 'bc', teamAId: 'b', teamBId: 'c', winnerTeamId: null }
			],
			rubbers: [
				{ id: 'r1', tieId: 'ab', matchId: null, winnerSide: 'A' },
				{ id: 'r2', tieId: 'ab', matchId: null, winnerSide: 'A' },
				{ id: 'r3', tieId: 'ac', matchId: null, winnerSide: 'B' },
				{ id: 'r4', tieId: 'ac', matchId: null, winnerSide: 'B' },
				{ id: 'r5', tieId: 'bc', matchId: null, winnerSide: 'A' },
				{ id: 'r6', tieId: 'bc', matchId: null, winnerSide: 'A' }
			],
			matches: []
		});

		for (const row of standings) {
			expect(row.tiedTeamsRubbersWon).not.toBeNull();
		}
		const topTeam = standings[0];
		expect(topTeam.tiedTeamsRubbersWon).toBeGreaterThan(0);
	});

	test('teams with identical stats remain ranked until their head-to-head is complete', () => {
		const standings = calculateGroupStandingsFromRecords({
			teams: teams.slice(0, 2),
			ties: [{ id: 'ab', teamAId: 'a', teamBId: 'b', winnerTeamId: null }],
			rubbers: [],
			matches: []
		});

		expect(standings[0].requiresTiebreaker).toBe(false);
		expect(standings[1].requiresTiebreaker).toBe(false);
		expect(standings[0].rank).toBe(1);
		expect(standings[1].rank).toBe(2);
	});

	test('marks identical stats as requiring a tiebreaker after all round-robin ties are complete', () => {
		const standings = calculateGroupStandingsFromRecords({
			teams,
			ties: [
				{ id: 'ab', teamAId: 'a', teamBId: 'b', winnerTeamId: 'a' },
				{ id: 'ac', teamAId: 'a', teamBId: 'c', winnerTeamId: 'c' },
				{ id: 'bc', teamAId: 'b', teamBId: 'c', winnerTeamId: 'b' }
			],
			rubbers: [],
			matches: []
		});

		expect(standings).toEqual([
			expect.objectContaining({ teamId: 'a', rank: null, requiresTiebreaker: true }),
			expect.objectContaining({ teamId: 'b', rank: null, requiresTiebreaker: true }),
			expect.objectContaining({ teamId: 'c', rank: null, requiresTiebreaker: true })
		]);
	});
});
