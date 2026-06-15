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
			expect.objectContaining({ teamId: 'b', rank: 1, requiresTiebreaker: false })
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
		expect(standings[1].rank).toBe(1);
	});

	describe('競技規則 順位決定基準', () => {
		const fourTeams = [
			{ id: 'a', name: 'Alpha' },
			{ id: 'b', name: 'Beta' },
			{ id: 'c', name: 'Gamma' },
			{ id: 'd', name: 'Delta' }
		];

		test('① 勝利数で明らかに差がある場合、勝利数順に異なる順位がつく', () => {
			const standings = calculateGroupStandingsFromRecords({
				teams,
				ties: [
					{ id: 'ab', teamAId: 'a', teamBId: 'b', winnerTeamId: 'a' },
					{ id: 'ac', teamAId: 'a', teamBId: 'c', winnerTeamId: 'a' },
					{ id: 'bc', teamAId: 'b', teamBId: 'c', winnerTeamId: 'b' }
				],
				rubbers: [],
				matches: []
			});

			expect(standings.map((r) => [r.teamId, r.rank, r.teamMatchesWon])).toEqual([
				['a', 1, 2],
				['b', 2, 1],
				['c', 3, 0]
			]);
		});

		test('② 勝利数が同率の場合、直接対決の勝者が上位になる', () => {
			const standings = calculateGroupStandingsFromRecords({
				teams: fourTeams,
				ties: [
					{ id: 'ab', teamAId: 'a', teamBId: 'b', winnerTeamId: 'b' },
					{ id: 'ac', teamAId: 'a', teamBId: 'c', winnerTeamId: 'a' },
					{ id: 'ad', teamAId: 'a', teamBId: 'd', winnerTeamId: 'a' },
					{ id: 'bc', teamAId: 'b', teamBId: 'c', winnerTeamId: 'b' },
					{ id: 'bd', teamAId: 'b', teamBId: 'd', winnerTeamId: 'd' },
					{ id: 'cd', teamAId: 'c', teamBId: 'd', winnerTeamId: 'c' }
				],
				rubbers: [],
				matches: []
			});

			const a = standings.find((row) => row.teamId === 'a')!;
			const b = standings.find((row) => row.teamId === 'b')!;
			expect(a.teamMatchesWon).toBe(b.teamMatchesWon);
			expect(b.headToHeadSummary).toBe('直接対決勝利');
			expect(a.headToHeadSummary).toBe('直接対決敗戦');
			expect(b.rank).toBeLessThan(a.rank!);
		});

		test('③ 勝利数・直接対決が同率の場合、ラバー勝利数で順位が分かれる', () => {
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

			expect(standings.map((r) => [r.teamId, r.rank, r.rubbersWon])).toEqual([
				['a', 1, 2],
				['b', 2, 1]
			]);
		});

		test('④ 勝利数・ラバー勝利数が同率の3チームの場合、同率チーム間ラバー勝利数で順位が分かれる', () => {
			const standings = calculateGroupStandingsFromRecords({
				teams: fourTeams,
				ties: [
					{ id: 'ab', teamAId: 'a', teamBId: 'b', winnerTeamId: null },
					{ id: 'ac', teamAId: 'a', teamBId: 'c', winnerTeamId: null },
					{ id: 'ad', teamAId: 'a', teamBId: 'd', winnerTeamId: 'a' },
					{ id: 'bc', teamAId: 'b', teamBId: 'c', winnerTeamId: null },
					{ id: 'bd', teamAId: 'b', teamBId: 'd', winnerTeamId: 'b' },
					{ id: 'cd', teamAId: 'c', teamBId: 'd', winnerTeamId: 'c' }
				],
				rubbers: [
					{ id: 'r1', tieId: 'ab', matchId: null, winnerSide: 'A' },
					{ id: 'r2', tieId: 'ab', matchId: null, winnerSide: 'A' },
					{ id: 'r3', tieId: 'ab', matchId: null, winnerSide: 'A' },
					{ id: 'r4', tieId: 'ac', matchId: null, winnerSide: 'A' },
					{ id: 'r5', tieId: 'ac', matchId: null, winnerSide: 'B' },
					{ id: 'r6', tieId: 'bc', matchId: null, winnerSide: 'A' },
					{ id: 'r7', tieId: 'bc', matchId: null, winnerSide: 'A' },
					{ id: 'r8', tieId: 'bd', matchId: null, winnerSide: 'A' },
					{ id: 'r9', tieId: 'bd', matchId: null, winnerSide: 'A' },
					{ id: 'r10', tieId: 'cd', matchId: null, winnerSide: 'A' },
					{ id: 'r11', tieId: 'cd', matchId: null, winnerSide: 'A' },
					{ id: 'r12', tieId: 'cd', matchId: null, winnerSide: 'A' }
				],
				matches: []
			});

			const tiedRows = standings.filter((row) => ['a', 'b', 'c'].includes(row.teamId));
			expect(new Set(tiedRows.map((row) => row.teamMatchesWon))).toEqual(new Set([1]));
			expect(new Set(tiedRows.map((row) => row.rubbersWon))).toEqual(new Set([4]));
			expect(tiedRows.map((row) => [row.teamId, row.rank, row.tiedTeamsRubbersWon])).toEqual([
				['a', 1, 4],
				['b', 2, 2],
				['c', 3, 1]
			]);
		});

		test('⑤ 勝利数・ラバー数・同率間ラバー数が同率の場合、獲得ゲーム数で順位が分かれる', () => {
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

			expect(standings.map((r) => [r.teamId, r.rank, r.gamesWon])).toEqual([
				['a', 1, 3],
				['b', 2, 2]
			]);
		});

		test('⑥ 勝利数・ラバー数・同率間ラバー数・総獲得ゲーム数が同率の場合、同率チーム間獲得ゲーム数で順位が分かれる', () => {
			const standings = calculateGroupStandingsFromRecords({
				teams: fourTeams,
				ties: [
					{ id: 'ab', teamAId: 'a', teamBId: 'b', winnerTeamId: null },
					{ id: 'ac', teamAId: 'a', teamBId: 'c', winnerTeamId: null },
					{ id: 'ad', teamAId: 'a', teamBId: 'd', winnerTeamId: 'a' },
					{ id: 'bc', teamAId: 'b', teamBId: 'c', winnerTeamId: null },
					{ id: 'bd', teamAId: 'b', teamBId: 'd', winnerTeamId: 'b' },
					{ id: 'cd', teamAId: 'c', teamBId: 'd', winnerTeamId: 'c' }
				],
				rubbers: [
					{ id: 'r-ab', tieId: 'ab', matchId: 'm-ab', winnerSide: 'A' },
					{ id: 'r-ac', tieId: 'ac', matchId: 'm-ac', winnerSide: 'B' },
					{ id: 'r-ad', tieId: 'ad', matchId: 'm-ad', winnerSide: 'A' },
					{ id: 'r-bc', tieId: 'bc', matchId: 'm-bc', winnerSide: 'A' },
					{ id: 'r-bd', tieId: 'bd', matchId: 'm-bd', winnerSide: 'A' },
					{ id: 'r-cd', tieId: 'cd', matchId: 'm-cd', winnerSide: 'A' }
				],
				matches: [
					{ id: 'm-ab', gamesWonA: 2, gamesWonB: 0 },
					{ id: 'm-ac', gamesWonA: 0, gamesWonB: 2 },
					{ id: 'm-ad', gamesWonA: 2, gamesWonB: 0 },
					{ id: 'm-bc', gamesWonA: 1, gamesWonB: 0 },
					{ id: 'm-bd', gamesWonA: 3, gamesWonB: 0 },
					{ id: 'm-cd', gamesWonA: 2, gamesWonB: 0 }
				]
			});

			const tiedRows = standings.filter((row) => ['a', 'b', 'c'].includes(row.teamId));
			expect(new Set(tiedRows.map((row) => row.teamMatchesWon))).toEqual(new Set([1]));
			expect(new Set(tiedRows.map((row) => row.rubbersWon))).toEqual(new Set([2]));
			expect(new Set(tiedRows.map((row) => row.tiedTeamsRubbersWon))).toEqual(new Set([1]));
			expect(new Set(tiedRows.map((row) => row.gamesWon))).toEqual(new Set([4]));
			expect(tiedRows.map((row) => [row.teamId, row.rank, row.tiedTeamsGamesWon])).toEqual([
				['a', 1, 2],
				['c', 1, 2],
				['b', 2, 1]
			]);
		});

		test('①〜⑥がすべて同じ場合、同じ順位がつく', () => {
			const standings = calculateGroupStandingsFromRecords({
				teams: teams.slice(0, 2),
				ties: [{ id: 'ab', teamAId: 'a', teamBId: 'b', winnerTeamId: null }],
				rubbers: [
					{ id: 'r1', tieId: 'ab', matchId: 'm1', winnerSide: 'A' },
					{ id: 'r2', tieId: 'ab', matchId: 'm2', winnerSide: 'B' }
				],
				matches: [
					{ id: 'm1', gamesWonA: 1, gamesWonB: 0 },
					{ id: 'm2', gamesWonA: 0, gamesWonB: 1 }
				]
			});

			expect(standings).toEqual([
				expect.objectContaining({
					teamId: 'a',
					rank: 1,
					teamMatchesWon: 0,
					rubbersWon: 1,
					tiedTeamsRubbersWon: 1,
					gamesWon: 1,
					tiedTeamsGamesWon: 1
				}),
				expect.objectContaining({
					teamId: 'b',
					rank: 1,
					teamMatchesWon: 0,
					rubbersWon: 1,
					tiedTeamsRubbersWon: 1,
					gamesWon: 1,
					tiedTeamsGamesWon: 1
				})
			]);
		});
	});

	describe('dense ranking (同位順位)', () => {
		test('完全に同率のチームは同じ順位になる', () => {
			// a と b は全く同じ戦績 → 共に1位
			const standings = calculateGroupStandingsFromRecords({
				teams: teams.slice(0, 2),
				ties: [{ id: 'ab', teamAId: 'a', teamBId: 'b', winnerTeamId: null }],
				rubbers: [],
				matches: []
			});

			expect(standings[0].rank).toBe(1);
			expect(standings[1].rank).toBe(1);
		});

		test('非同率のチームは異なる順位になる', () => {
			// a:2勝, b:1勝, c:0勝 → 全て異なる順位
			const standings = calculateGroupStandingsFromRecords({
				teams,
				ties: [
					{ id: 'ab', teamAId: 'a', teamBId: 'b', winnerTeamId: 'a' },
					{ id: 'ac', teamAId: 'a', teamBId: 'c', winnerTeamId: 'a' },
					{ id: 'bc', teamAId: 'b', teamBId: 'c', winnerTeamId: 'b' }
				],
				rubbers: [],
				matches: []
			});

			const ranks = standings.map((r) => r.rank);
			expect(new Set(ranks).size).toBe(3);
			expect(ranks).toEqual([1, 2, 3]);
		});

		test('同率チームと非同率チームが混在する場合、同率は同じ順位で非同率は次の順位になる', () => {
			// a と b は同率(各1勝), c は0勝
			const standings = calculateGroupStandingsFromRecords({
				teams,
				ties: [
					{ id: 'ab', teamAId: 'a', teamBId: 'b', winnerTeamId: null },
					{ id: 'ac', teamAId: 'a', teamBId: 'c', winnerTeamId: 'a' },
					{ id: 'bc', teamAId: 'b', teamBId: 'c', winnerTeamId: 'b' }
				],
				rubbers: [],
				matches: []
			});

			expect(standings.map((r) => [r.teamId, r.rank])).toEqual([
				['a', 1],
				['b', 1],
				['c', 2]
			]);
		});
	});

	test('keeps identical round-robin stats at the same rank after all ties are complete', () => {
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
			expect.objectContaining({ teamId: 'a', rank: 1, requiresTiebreaker: false }),
			expect.objectContaining({ teamId: 'b', rank: 1, requiresTiebreaker: false }),
			expect.objectContaining({ teamId: 'c', rank: 1, requiresTiebreaker: false })
		]);
	});
});
