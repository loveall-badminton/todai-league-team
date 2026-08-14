import { describe, expect, test } from 'vitest';
import type { GroupCode } from '$lib/domain/tokyoLeague';
import type { LiveTopic, LiveUpdateData } from './channels';
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

function updateData(data: LiveUpdateData | undefined): LiveUpdateData | undefined {
	return data;
}

function scoreState(matchId: string, status: 'playing' | 'finished' = 'playing') {
	return {
		schemaVersion: 1 as const,
		matchId,
		tournamentId: 't1',
		courtId: null,
		discipline: 'MD' as const,
		status,
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
	};
}

describe('realtime consumer routing', () => {
	test('finals page ignores unrelated group schedule metadata', () => {
		expect(
			shouldRefreshFinalsPage(
				liveUpdate({
					topics: ['schedule'],
					data: { schedule: { phases: ['group_a'] as const, tieIds: ['a-1'] } }
				}),
				['X-1', 'X-2']
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
				['X-1', 'X-2']
			)
		).toBe(true);
		expect(
			shouldRefreshFinalsPage(
				liveUpdate({
					topics: ['finals']
				}),
				['X-1', 'X-2']
			)
		).toBe(true);
	});

	test('finals page refreshes on relevant finals phase metadata', () => {
		expect(
			shouldRefreshFinalsPage(
				liveUpdate({
					topics: ['finals'],
					data: { finals: { phases: ['final'] as const } }
				}),
				['X-1', 'X-2']
			)
		).toBe(true);
	});

	test('finals page refreshes on relevant tie id in finals payload', () => {
		expect(
			shouldRefreshFinalsPage(
				liveUpdate({
					topics: ['finals'],
					data: { finals: { tieIds: ['X-1'] } }
				}),
				['X-1', 'X-2']
			)
		).toBe(true);
	});

	test('finals page ignores unrelated finals and schedule metadata', () => {
		expect(
			shouldRefreshFinalsPage(
				liveUpdate({
					topics: ['finals'],
					data: { finals: { tieIds: ['other-1'], phases: ['group_a'] as const } }
				}),
				['X-1', 'X-2']
			)
		).toBe(false);
		expect(
			shouldRefreshFinalsPage(
				liveUpdate({
					topics: ['schedule'],
					data: { schedule: { phases: ['group_a'] as const } }
				}),
				['X-1', 'X-2']
			)
		).toBe(false);
	});

	test('group page ignores standings metadata for another group', () => {
		expect(
			shouldRefreshGroupPage(
				liveUpdate({
					topics: ['standings'],
					data: { standings: { groupCodes: ['B'] as const } }
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
					data: { schedule: { tieIds: ['tie-1'], scopes: ['lineups'] as const } }
				}),
				'tie-1'
			)
		).toBe(false);
		expect(
			shouldRefreshTieHeaderData(
				liveUpdate({
					topics: ['schedule'],
					data: { schedule: { tieIds: ['tie-1'], scopes: ['tie_header'] as const } }
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
					data: { schedule: { tieIds: ['tie-1'], scopes: ['tie_header'] as const } }
				}),
				'tie-1'
			)
		).toBe(false);
		expect(
			shouldRefreshTieLineups(
				liveUpdate({
					topics: ['schedule'],
					data: { schedule: { tieIds: ['tie-1'], scopes: ['lineups'] as const } }
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
					data: {
						schedule: {
							tieIds: ['tie-1'],
							phases: ['group_a'] as const,
							scopes: ['rubbers'] as const
						}
					}
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
					data: { schedule: { tieIds: ['tie-1'], scopes: ['lineups'] as const } }
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

	describe('shouldRefreshFinalsPage branch coverage', () => {
		test.each([
			{
				label: 'empty finals payload',
				topics: ['finals'],
				data: updateData({ finals: {} }),
				expected: true
			},
			{
				label: 'finals payload with only irrelevant phases',
				topics: ['finals'],
				data: updateData({ finals: { phases: ['group_a'] } }),
				expected: false
			},
			{
				label: 'finals payload with irrelevant tie id and no phases',
				topics: ['finals'],
				data: updateData({ finals: { tieIds: ['other-1'] } }),
				expected: false
			},
			{
				label: 'schedule payload missing',
				topics: ['schedule'],
				data: updateData(undefined),
				expected: true
			},
			{
				label: 'empty schedule payload',
				topics: ['schedule'],
				data: updateData({ schedule: {} }),
				expected: true
			},
			{
				label: 'schedule relevant tie id',
				topics: ['schedule'],
				data: updateData({ schedule: { tieIds: ['X-1'] } }),
				expected: true
			},
			{
				label: 'schedule relevant finals phase',
				topics: ['schedule'],
				data: updateData({ schedule: { phases: ['final'] } }),
				expected: true
			},
			{
				label: 'unrelated topic',
				topics: ['score'],
				data: updateData(undefined),
				expected: false
			}
		])('$label', ({ topics, data, expected }) => {
			expect(
				shouldRefreshFinalsPage(liveUpdate({ topics: topics as LiveTopic[], data }), ['X-1', 'X-2'])
			).toBe(expected);
		});
	});

	describe('shouldRefreshGroupPage branch coverage', () => {
		test.each([
			{
				label: 'standings payload missing',
				topics: ['standings'],
				data: updateData({}),
				expected: true
			},
			{
				label: 'empty standings payload',
				topics: ['standings'],
				data: updateData({ standings: {} }),
				expected: true
			},
			{
				label: 'matching group code',
				topics: ['standings'],
				data: updateData({ standings: { groupCodes: ['A'] } }),
				expected: true
			},
			{
				label: 'relevant tie id in standings',
				topics: ['standings'],
				data: updateData({ standings: { tieIds: ['a-1'] } }),
				expected: true
			},
			{
				label: 'schedule payload missing',
				topics: ['schedule'],
				data: updateData(undefined),
				expected: true
			},
			{
				label: 'empty schedule payload',
				topics: ['schedule'],
				data: updateData({ schedule: {} }),
				expected: true
			},
			{
				label: 'matching group phase',
				topics: ['schedule'],
				data: updateData({ schedule: { phases: ['group_a'] } }),
				expected: true
			},
			{
				label: 'wrong group phase',
				topics: ['schedule'],
				data: updateData({ schedule: { phases: ['group_a'] } }),
				groupCode: 'B' as GroupCode,
				expected: false
			},
			{
				label: 'unrelated topic',
				topics: ['finals'],
				data: updateData(undefined),
				expected: false
			}
		])('$label', ({ topics, data, groupCode = 'A' as GroupCode, expected }) => {
			expect(
				shouldRefreshGroupPage(liveUpdate({ topics: topics as LiveTopic[], data }), groupCode, [
					'a-1',
					'a-2'
				])
			).toBe(expected);
		});
	});

	describe('shouldRefreshTieHeaderData branch coverage', () => {
		test.each([
			{
				label: 'schedule payload missing',
				topics: ['schedule'],
				data: updateData({}),
				expected: true
			},
			{
				label: 'empty schedule payload',
				topics: ['schedule'],
				data: updateData({ schedule: {} }),
				expected: true
			},
			{
				label: 'schedule tie id with no scopes',
				topics: ['schedule'],
				data: updateData({ schedule: { tieIds: ['tie-1'] } }),
				expected: true
			},
			{
				label: 'schedule tie id with empty scopes',
				topics: ['schedule'],
				data: updateData({ schedule: { tieIds: ['tie-1'], scopes: [] } }),
				expected: true
			},
			{
				label: 'schedule tie id with lineups scope',
				topics: ['schedule'],
				data: updateData({ schedule: { tieIds: ['tie-1'], scopes: ['lineups'] } }),
				expected: false
			},
			{
				label: 'schedule phases without tie id',
				topics: ['schedule'],
				data: updateData({ schedule: { phases: ['group_a'] } }),
				expected: false
			},
			{
				label: 'standings empty payload',
				topics: ['standings'],
				data: updateData({ standings: {} }),
				expected: true
			},
			{
				label: 'standings relevant tie id',
				topics: ['standings'],
				data: updateData({ standings: { tieIds: ['tie-1'] } }),
				expected: true
			},
			{
				label: 'standings groupCodes only',
				topics: ['standings'],
				data: updateData({ standings: { groupCodes: ['A'] } }),
				expected: false
			},
			{
				label: 'finals empty payload',
				topics: ['finals'],
				data: updateData({ finals: {} }),
				expected: true
			},
			{
				label: 'finals relevant tie id',
				topics: ['finals'],
				data: updateData({ finals: { tieIds: ['tie-1'] } }),
				expected: true
			},
			{
				label: 'finals phases only',
				topics: ['finals'],
				data: updateData({ finals: { phases: ['final'] } }),
				expected: false
			},
			{
				label: 'unrelated topic',
				topics: ['score'],
				data: updateData(undefined),
				expected: false
			}
		])('$label', ({ topics, data, expected }) => {
			expect(
				shouldRefreshTieHeaderData(liveUpdate({ topics: topics as LiveTopic[], data }), 'tie-1')
			).toBe(expected);
		});
	});

	describe('shouldRefreshTieLineups branch coverage', () => {
		test.each([
			{
				label: 'non-schedule topic',
				topics: ['standings'],
				data: updateData(undefined),
				expected: false
			},
			{
				label: 'empty schedule payload',
				topics: ['schedule'],
				data: updateData({ schedule: {} }),
				expected: true
			},
			{
				label: 'schedule tie id with no scopes',
				topics: ['schedule'],
				data: updateData({ schedule: { tieIds: ['tie-1'] } }),
				expected: true
			},
			{
				label: 'schedule tie id with empty scopes',
				topics: ['schedule'],
				data: updateData({ schedule: { tieIds: ['tie-1'], scopes: [] } }),
				expected: true
			},
			{
				label: 'schedule wrong tie id',
				topics: ['schedule'],
				data: updateData({ schedule: { tieIds: ['other'] } }),
				expected: false
			},
			{
				label: 'schedule phases only',
				topics: ['schedule'],
				data: updateData({ schedule: { phases: ['group_a'] } }),
				expected: false
			}
		])('$label', ({ topics, data, expected }) => {
			expect(
				shouldRefreshTieLineups(liveUpdate({ topics: topics as LiveTopic[], data }), 'tie-1')
			).toBe(expected);
		});
	});

	describe('shouldRefreshTieLiveRubbers branch coverage', () => {
		test.each([
			{
				label: 'score topic without score payload',
				topics: ['score'],
				data: updateData(undefined),
				expected: true
			},
			{
				label: 'score topic matching match id',
				topics: ['score'],
				data: updateData({ score: { state: scoreState('m1', 'playing') } }),
				expected: true
			},
			{
				label: 'schedule payload missing',
				topics: ['schedule'],
				data: updateData(undefined),
				expected: true
			},
			{
				label: 'empty schedule payload',
				topics: ['schedule'],
				data: updateData({ schedule: {} }),
				expected: true
			},
			{
				label: 'schedule tie id with no scopes',
				topics: ['schedule'],
				data: updateData({ schedule: { tieIds: ['tie-1'] } }),
				expected: true
			},
			{
				label: 'schedule wrong tie id',
				topics: ['schedule'],
				data: updateData({ schedule: { tieIds: ['other'] } }),
				expected: false
			},
			{
				label: 'schedule phases only',
				topics: ['schedule'],
				data: updateData({ schedule: { phases: ['group_a'] } }),
				expected: false
			},
			{
				label: 'unrelated topic',
				topics: ['standings'],
				data: updateData(undefined),
				expected: false
			}
		])('$label', ({ topics, data, expected }) => {
			expect(
				shouldRefreshTieLiveRubbers(liveUpdate({ topics: topics as LiveTopic[], data }), 'tie-1', [
					'm1'
				])
			).toBe(expected);
		});
	});

	describe('shouldRefreshOnScheduleOrTerminalScore branch coverage', () => {
		test('returns true when score topic has no score payload', () => {
			expect(shouldRefreshOnScheduleOrTerminalScore(liveUpdate({ topics: ['score'] }))).toBe(true);
		});
	});
});
