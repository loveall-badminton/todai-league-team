import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
	matchSidePlayers,
	matchSides,
	matchSnapshots,
	matchServiceStates,
	matches,
	rankingTiebreakers
} from '$lib/server/db/schema';
import { validateRankingTiebreakerSelection } from './rankingTiebreakerService';

type ScoringRuleRow = {
	id: string;
	maxGames: number;
	gamesToWin: number;
	pointsToWin: number;
	winBy: number;
	maxPoints: number;
	midGameIntervalPoint: number;
};

type TeamRow = {
	id: string;
	name: string;
};

type PlayerRow = {
	id: string;
	teamId: string;
	name: string;
};

type InsertResult = {
	onConflictDoUpdate: (args: object) => void;
};

type InsertBuilder = {
	values: (rows: object) => InsertResult;
};

type UpdateBuilder = {
	set: (values: object) => {
		where: (clause: object) => void;
	};
};

type MockDb = {
	query: {
		scoringRules: {
			findFirst: (args: object) => Promise<ScoringRuleRow | null>;
		};
		teams: {
			findFirst: (args: object) => Promise<TeamRow | null>;
		};
		teamPlayers: {
			findFirst: (args: object) => Promise<PlayerRow | null>;
		};
	};
	insert: (
		table: typeof rankingTiebreakers | typeof matches | typeof matchSides | typeof matchSidePlayers
	) => InsertBuilder;
	update: (table: typeof rankingTiebreakers) => UpdateBuilder;
	batch: (queries: readonly object[]) => Promise<readonly []>;
};

type MockTable =
	| typeof rankingTiebreakers
	| typeof matches
	| typeof matchSides
	| typeof matchSidePlayers
	| typeof matchSnapshots
	| typeof matchServiceStates;

const mockState = vi.hoisted(
	(): {
		db: MockDb | null;
		actions: string[];
		teamQueryCalls: number;
		playerQueryCalls: number;
	} => ({
		db: null,
		actions: [],
		teamQueryCalls: 0,
		playerQueryCalls: 0
	})
);

vi.mock('$lib/server/db/request', () => ({
	getRequestDb: () => {
		if (!mockState.db) throw new Error('test db is not initialized');
		return mockState.db;
	}
}));

vi.mock('./tokyoLeagueSetupService', () => ({
	INTERNAL_TOURNAMENT_ID: 'tokyo-league-default',
	ensureDefaultSettings: async () => ({ tiebreakerScoringRuleId: 'TB' }),
	ensureInternalTournament: async () => undefined,
	scoringConfigFromRule: (rule: { maxGames: number }) => ({ maxGames: rule.maxGames })
}));

import { createRankingTiebreaker } from './rankingTiebreakerService';

function createInsertBuilder(tableName: string): InsertBuilder {
	return {
		values: () => ({
			onConflictDoUpdate: () => {
				mockState.actions.push(`upsert:${tableName}`);
			}
		})
	};
}

function createUpdateBuilder(tableName: string): UpdateBuilder {
	return {
		set: () => ({
			where: () => {
				mockState.actions.push(`update:${tableName}`);
			}
		})
	};
}

function createMockDb(): MockDb {
	const tableNames = new Map<MockTable, string>([
		[rankingTiebreakers, 'ranking_tiebreakers'],
		[matches, 'matches'],
		[matchSides, 'match_sides'],
		[matchSidePlayers, 'match_side_players'],
		[matchSnapshots, 'match_snapshots'],
		[matchServiceStates, 'match_service_states']
	]);

	return {
		query: {
			scoringRules: {
				findFirst: async () => ({
					id: 'TB',
					maxGames: 1,
					gamesToWin: 1,
					pointsToWin: 21,
					winBy: 2,
					maxPoints: 30,
					midGameIntervalPoint: 11
				})
			},
			teams: {
				findFirst: async () => {
					mockState.teamQueryCalls += 1;
					return mockState.teamQueryCalls === 1
						? { id: 'team-a', name: 'A' }
						: { id: 'team-b', name: 'B' };
				}
			},
			teamPlayers: {
				findFirst: async () => {
					mockState.playerQueryCalls += 1;
					if (mockState.playerQueryCalls === 1)
						return { id: 'a-f1', teamId: 'team-a', name: 'A 女1' };
					if (mockState.playerQueryCalls === 2)
						return { id: 'a-m1', teamId: 'team-a', name: 'A 男1' };
					if (mockState.playerQueryCalls === 3)
						return { id: 'b-f1', teamId: 'team-b', name: 'B 女1' };
					return { id: 'b-m1', teamId: 'team-b', name: 'B 男1' };
				}
			}
		},
		insert: (table) => {
			const name = tableNames.get(table);
			if (name) {
				mockState.actions.push(`insert:${name}`);
				return createInsertBuilder(name);
			}
			throw new Error('unexpected table');
		},
		update: (table) => {
			const name = tableNames.get(table);
			if (name === 'ranking_tiebreakers') return createUpdateBuilder(name);
			throw new Error('unexpected table');
		},
		batch: async () => {
			mockState.actions.push('batch');
			return [];
		}
	};
}

beforeEach(() => {
	mockState.actions = [];
	mockState.db = createMockDb();
	mockState.teamQueryCalls = 0;
	mockState.playerQueryCalls = 0;
});

describe('validateRankingTiebreakerSelection', () => {
	test('accepts two players from each target team and returns the validated values', () => {
		const teamA = { id: 'team-a', name: 'A' };
		const teamB = { id: 'team-b', name: 'B' };
		const playersA = [
			{ id: 'player-a1', teamId: 'team-a', name: 'A選手1' },
			{ id: 'player-a2', teamId: 'team-a', name: 'A選手2' }
		];
		const playersB = [
			{ id: 'player-b1', teamId: 'team-b', name: 'B選手1' },
			{ id: 'player-b2', teamId: 'team-b', name: 'B選手2' }
		];

		expect(
			validateRankingTiebreakerSelection({ teamA, teamB, discipline: 'MD', playersA, playersB })
		).toEqual({
			teamA,
			teamB,
			playersA,
			playersB
		});
	});

	test('rejects side A players outside the target team', () => {
		expect(() =>
			validateRankingTiebreakerSelection({
				teamA: { id: 'team-a' },
				teamB: { id: 'team-b' },
				discipline: 'MD',
				playersA: [
					{ id: 'player-a1', teamId: 'team-a' },
					{ id: 'player-a2', teamId: 'team-b' }
				],
				playersB: [
					{ id: 'player-b1', teamId: 'team-b' },
					{ id: 'player-b2', teamId: 'team-b' }
				]
			})
		).toThrow('再試合選手は対象チーム所属から選択してください');
	});

	test('rejects side B players outside the target team', () => {
		expect(() =>
			validateRankingTiebreakerSelection({
				teamA: { id: 'team-a' },
				teamB: { id: 'team-b' },
				discipline: 'MD',
				playersA: [
					{ id: 'player-a1', teamId: 'team-a' },
					{ id: 'player-a2', teamId: 'team-a' }
				],
				playersB: [
					{ id: 'player-b1', teamId: 'team-b' },
					{ id: 'player-b2', teamId: 'team-a' }
				]
			})
		).toThrow('再試合選手は対象チーム所属から選択してください');
	});

	test('rejects a tiebreaker within the same team', () => {
		expect(() =>
			validateRankingTiebreakerSelection({
				teamA: { id: 'team-a' },
				teamB: { id: 'team-a' },
				discipline: 'MD',
				playersA: [
					{ id: 'player-a1', teamId: 'team-a' },
					{ id: 'player-a2', teamId: 'team-a' }
				],
				playersB: [
					{ id: 'player-b1', teamId: 'team-a' },
					{ id: 'player-b2', teamId: 'team-a' }
				]
			})
		).toThrow('順位決定再試合は異なるチーム間で作成してください');
	});

	test('rejects duplicate players on a side', () => {
		expect(() =>
			validateRankingTiebreakerSelection({
				teamA: { id: 'team-a' },
				teamB: { id: 'team-b' },
				discipline: 'MD',
				playersA: [
					{ id: 'player-a1', teamId: 'team-a' },
					{ id: 'player-a1', teamId: 'team-a' }
				],
				playersB: [
					{ id: 'player-b1', teamId: 'team-b' },
					{ id: 'player-b2', teamId: 'team-b' }
				]
			})
		).toThrow('A側の再試合選手が重複しています');
	});

	test('rejects players whose gender does not match the selected discipline', () => {
		expect(() =>
			validateRankingTiebreakerSelection({
				teamA: { id: 'team-a' },
				teamB: { id: 'team-b' },
				discipline: 'XD',
				playersA: [
					{ id: 'player-a1', teamId: 'team-a', gender: 'female' },
					{ id: 'player-a2', teamId: 'team-a', gender: 'male' }
				],
				playersB: [
					{ id: 'player-b1', teamId: 'team-b', gender: 'male' },
					{ id: 'player-b2', teamId: 'team-b', gender: 'female' }
				]
			})
		).toThrow('再試合選手の性別が種目条件に一致していません');
	});

	test('allows unknown gender for any selected discipline', () => {
		expect(() =>
			validateRankingTiebreakerSelection({
				teamA: { id: 'team-a' },
				teamB: { id: 'team-b' },
				discipline: 'WD',
				playersA: [
					{ id: 'player-a1', teamId: 'team-a', gender: 'unknown' },
					{ id: 'player-a2', teamId: 'team-a', gender: 'female' }
				],
				playersB: [
					{ id: 'player-b1', teamId: 'team-b', gender: 'female' },
					{ id: 'player-b2', teamId: 'team-b', gender: 'unknown' }
				]
			})
		).not.toThrow();
	});

	test.each([
		['teamA', { teamA: null }],
		['teamB', { teamB: null }],
		['playersA', { playersA: [null] }],
		['playersB', { playersB: [null] }]
	])('rejects when %s is missing', (_label, overrides) => {
		expect(() =>
			validateRankingTiebreakerSelection({
				teamA: { id: 'team-a' },
				teamB: { id: 'team-b' },
				discipline: 'MD',
				playersA: [
					{ id: 'player-a1', teamId: 'team-a' },
					{ id: 'player-a2', teamId: 'team-a' }
				],
				playersB: [
					{ id: 'player-b1', teamId: 'team-b' },
					{ id: 'player-b2', teamId: 'team-b' }
				],
				...overrides
			})
		).toThrow('チームまたは選手が見つかりません');
	});
});

describe('createRankingTiebreaker', () => {
	test('creates the tiebreaker row before batching dependent match rows', async () => {
		const result = await createRankingTiebreaker({
			groupCode: 'A',
			reason: '1位同率',
			teamAId: 'team-a',
			teamBId: 'team-b',
			discipline: 'XD',
			playerA1Id: 'a-f1',
			playerA2Id: 'a-m1',
			playerB1Id: 'b-f1',
			playerB2Id: 'b-m1',
			now: '2026-06-15T01:00:00.000Z'
		});

		expect(result.rankingTiebreakerId).toBeTruthy();
		expect(result.matchId).toBeTruthy();
		expect(mockState.actions[0]).toBe('insert:ranking_tiebreakers');
		expect(mockState.actions).toContain('batch');
		expect(mockState.actions.indexOf('insert:ranking_tiebreakers')).toBeLessThan(
			mockState.actions.indexOf('batch')
		);
	});
});
