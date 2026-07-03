import { describe, expect, test } from 'vitest';
import type { RealtimeUpdate } from './updates';
import {
	shouldRefreshOnScheduleOrTerminalScore,
	shouldRefreshFinalsPage,
	shouldRefreshGroupPage,
	shouldRefreshTieHeaderData,
	shouldRefreshTieLiveRubbers,
	shouldRefreshTieLineups,
	shouldRefreshTiesPage
} from './updates';

function liveUpdate(update: Partial<RealtimeUpdate>): RealtimeUpdate {
	return {
		topics: [],
		source: 'live',
		channel: 'live-board',
		...update
	};
}

describe('realtime consumer routing', () => {
	test('finals page ignores unrelated group schedule metadata', () => {
		expect(
			shouldRefreshFinalsPage(
				liveUpdate({
					topics: ['schedule'],
					data: { schedule: { phases: ['group_a'], tieIds: ['a-1'] } }
				}),
				['x-1', 'x-2']
			)
		).toBe(false);
	});

	test('finals page refreshes for poll updates and missing finals payloads', () => {
		expect(
			shouldRefreshFinalsPage(
				liveUpdate({
					source: 'poll',
					topics: ['schedule']
				}),
				['x-1', 'x-2']
			)
		).toBe(true);
		expect(
			shouldRefreshFinalsPage(
				liveUpdate({
					topics: ['finals']
				}),
				['x-1', 'x-2']
			)
		).toBe(true);
	});

	test('finals page refreshes on relevant finals phase metadata', () => {
		expect(
			shouldRefreshFinalsPage(
				liveUpdate({
					topics: ['finals'],
					data: { finals: { phases: ['final'] } }
				}),
				['x-1', 'x-2']
			)
		).toBe(true);
	});

	test('group page ignores standings metadata for another group', () => {
		expect(
			shouldRefreshGroupPage(
				liveUpdate({
					topics: ['standings'],
					data: { standings: { groupCodes: ['B'] } }
				}),
				'A',
				['a-1', 'a-2']
			)
		).toBe(false);
	});

	test('group page refreshes on matching tie id even without group code', () => {
		expect(
			shouldRefreshGroupPage(
				liveUpdate({
					topics: ['schedule'],
					data: { schedule: { tieIds: ['a-2'] } }
				}),
				'A',
				['a-1', 'a-2']
			)
		).toBe(true);
	});

	test('group page refreshes for poll updates and missing standings payloads', () => {
		expect(
			shouldRefreshGroupPage(
				liveUpdate({
					source: 'poll',
					topics: ['standings']
				}),
				'A',
				['a-1', 'a-2']
			)
		).toBe(true);
		expect(
			shouldRefreshGroupPage(
				liveUpdate({
					topics: ['standings']
				}),
				'A',
				['a-1', 'a-2']
			)
		).toBe(true);
	});

	test('ties page ignores non-terminal score updates', () => {
		expect(
			shouldRefreshTiesPage(
				liveUpdate({
					topics: ['score'],
					data: {
						score: {
							state: {
								schemaVersion: 1,
								matchId: 'm1',
								tournamentId: 't1',
								courtId: null,
								discipline: 'MD',
								status: 'playing',
								scoring: {
									maxGames: 3,
									gamesToWin: 2,
									pointsToWin: 21,
									winBy: 2,
									maxPoints: 30,
									midGameIntervalPoint: 11
								},
								currentGameNo: 1,
								games: [
									{
										gameNo: 1,
										score: { A: 5, B: 4 },
										winnerSide: null,
										midGameIntervalTaken: false,
										changeEndsRequired: false,
										changeEndsCompleted: false
									}
								],
								gamesWon: { A: 0, B: 0 },
								winnerSide: null,
								terminalReason: null,
								service: null,
								lastSeqNo: 9,
								createdAt: '2026-06-20T00:00:00.000Z',
								updatedAt: '2026-06-20T00:01:00.000Z'
							}
						}
					}
				})
			)
		).toBe(false);
	});

	test('ties page refreshes on terminal score updates', () => {
		expect(
			shouldRefreshTiesPage(
				liveUpdate({
					topics: ['score'],
					data: {
						score: {
							state: {
								schemaVersion: 1,
								matchId: 'm1',
								tournamentId: 't1',
								courtId: null,
								discipline: 'MD',
								status: 'finished',
								scoring: {
									maxGames: 3,
									gamesToWin: 2,
									pointsToWin: 21,
									winBy: 2,
									maxPoints: 30,
									midGameIntervalPoint: 11
								},
								currentGameNo: 2,
								games: [
									{
										gameNo: 1,
										score: { A: 21, B: 18 },
										winnerSide: 'A',
										midGameIntervalTaken: true,
										changeEndsRequired: false,
										changeEndsCompleted: false
									}
								],
								gamesWon: { A: 2, B: 0 },
								winnerSide: 'A',
								terminalReason: 'normal',
								service: null,
								lastSeqNo: 30,
								createdAt: '2026-06-20T00:00:00.000Z',
								updatedAt: '2026-06-20T00:10:00.000Z'
							}
						}
					}
				})
			)
		).toBe(true);
	});

	test('ties page refreshes for poll and schedule updates, and ignores unknown topics', () => {
		expect(
			shouldRefreshTiesPage(
				liveUpdate({
					source: 'poll'
				})
			)
		).toBe(true);
		expect(
			shouldRefreshTiesPage(
				liveUpdate({
					topics: ['schedule']
				})
			)
		).toBe(true);
		expect(
			shouldRefreshTiesPage(
				liveUpdate({
					topics: ['standings']
				})
			)
		).toBe(false);
	});

	test('tie header refreshes only when schedule metadata targets the tie and header scope', () => {
		expect(
			shouldRefreshTieHeaderData(
				liveUpdate({
					topics: ['schedule'],
					data: { schedule: { tieIds: ['other-tie'] } }
				}),
				'tie-1'
			)
		).toBe(false);
		expect(
			shouldRefreshTieHeaderData(
				liveUpdate({
					topics: ['schedule'],
					data: { schedule: { tieIds: ['tie-1'], scopes: ['lineups'] } }
				}),
				'tie-1'
			)
		).toBe(false);
		expect(
			shouldRefreshTieHeaderData(
				liveUpdate({
					topics: ['schedule'],
					data: { schedule: { tieIds: ['tie-1'], scopes: ['tie_header'] } }
				}),
				'tie-1'
			)
		).toBe(true);
	});

	test('tie header refreshes for poll, standings, and finals metadata missing payloads', () => {
		expect(shouldRefreshTieHeaderData(liveUpdate({ source: 'poll' }), 'tie-1')).toBe(true);
		expect(
			shouldRefreshTieHeaderData(
				liveUpdate({
					topics: ['standings']
				}),
				'tie-1'
			)
		).toBe(true);
		expect(
			shouldRefreshTieHeaderData(
				liveUpdate({
					topics: ['finals']
				}),
				'tie-1'
			)
		).toBe(true);
	});

	test('tie lineups refresh only when lineup schedule metadata targets the tie', () => {
		expect(
			shouldRefreshTieLineups(
				liveUpdate({
					topics: ['schedule'],
					data: { schedule: { tieIds: ['tie-1'], scopes: ['tie_header'] } }
				}),
				'tie-1'
			)
		).toBe(false);
		expect(
			shouldRefreshTieLineups(
				liveUpdate({
					topics: ['schedule'],
					data: { schedule: { tieIds: ['tie-1'], scopes: ['lineups'] } }
				}),
				'tie-1'
			)
		).toBe(true);
	});

	test('tie lineups refresh for poll and missing schedule payloads', () => {
		expect(shouldRefreshTieLineups(liveUpdate({ source: 'poll' }), 'tie-1')).toBe(true);
		expect(
			shouldRefreshTieLineups(
				liveUpdate({
					topics: ['schedule']
				}),
				'tie-1'
			)
		).toBe(true);
	});

	test('tie live rubbers refresh only for relevant match score updates', () => {
		expect(
			shouldRefreshTieLiveRubbers(
				liveUpdate({
					topics: ['score'],
					data: {
						score: {
							state: {
								schemaVersion: 1,
								matchId: 'm2',
								tournamentId: 't1',
								courtId: null,
								discipline: 'MD',
								status: 'playing',
								scoring: {
									maxGames: 3,
									gamesToWin: 2,
									pointsToWin: 21,
									winBy: 2,
									maxPoints: 30,
									midGameIntervalPoint: 11
								},
								currentGameNo: 1,
								games: [],
								gamesWon: { A: 0, B: 0 },
								winnerSide: null,
								terminalReason: null,
								service: null,
								lastSeqNo: 1,
								createdAt: '',
								updatedAt: ''
							}
						}
					}
				}),
				'tie-1',
				['m1']
			)
		).toBe(false);
	});

	test('tie live rubbers refresh for poll updates, missing score payloads, and relevant schedule phases', () => {
		expect(shouldRefreshTieLiveRubbers(liveUpdate({ source: 'poll' }), 'tie-1', ['m1'])).toBe(true);
		expect(
			shouldRefreshTieLiveRubbers(
				liveUpdate({
					topics: ['score']
				}),
				'tie-1',
				['m1']
			)
		).toBe(true);
		expect(
			shouldRefreshTieLiveRubbers(
				liveUpdate({
					topics: ['schedule'],
					data: { schedule: { tieIds: ['tie-1'], phases: ['group_a'], scopes: ['rubbers'] } }
				}),
				'tie-1',
				['m1']
			)
		).toBe(true);
	});

	test('tie live rubbers ignore lineup-only schedule updates', () => {
		expect(
			shouldRefreshTieLiveRubbers(
				liveUpdate({
					topics: ['schedule'],
					data: { schedule: { tieIds: ['tie-1'], scopes: ['lineups'] } }
				}),
				'tie-1',
				['m1']
			)
		).toBe(false);
	});

	test('dashboard subqueries ignore non-terminal score updates', () => {
		const update = liveUpdate({
			topics: ['score'],
			data: {
				score: {
					state: {
						schemaVersion: 1,
						matchId: 'm1',
						tournamentId: 't1',
						courtId: null,
						discipline: 'MD',
						status: 'playing',
						scoring: {
							maxGames: 3,
							gamesToWin: 2,
							pointsToWin: 21,
							winBy: 2,
							maxPoints: 30,
							midGameIntervalPoint: 11
						},
						currentGameNo: 1,
						games: [],
						gamesWon: { A: 0, B: 0 },
						winnerSide: null,
						terminalReason: null,
						service: null,
						lastSeqNo: 1,
						createdAt: '',
						updatedAt: ''
					}
				}
			}
		});
		expect(shouldRefreshOnScheduleOrTerminalScore(update)).toBe(false);
	});

	test('dashboard subqueries refresh for poll and schedule updates', () => {
		const pollUpdate = liveUpdate({ source: 'poll' });
		expect(shouldRefreshOnScheduleOrTerminalScore(pollUpdate)).toBe(true);

		const scheduleUpdate = liveUpdate({ topics: ['schedule'] });
		expect(shouldRefreshOnScheduleOrTerminalScore(scheduleUpdate)).toBe(true);
	});
});
