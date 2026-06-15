import { describe, expect, test } from 'vitest';
import { validateRankingTiebreakerSelection } from './rankingTiebreakerService';

describe('validateRankingTiebreakerSelection', () => {
	test('accepts one player from each target team and returns the validated values', () => {
		const teamA = { id: 'team-a', name: 'A' };
		const teamB = { id: 'team-b', name: 'B' };
		const playerA = { id: 'player-a', teamId: 'team-a', name: 'A選手' };
		const playerB = { id: 'player-b', teamId: 'team-b', name: 'B選手' };

		expect(validateRankingTiebreakerSelection({ teamA, teamB, playerA, playerB })).toEqual({
			teamA,
			teamB,
			playerA,
			playerB
		});
	});

	test('rejects playerA outside the target team', () => {
		expect(() =>
			validateRankingTiebreakerSelection({
				teamA: { id: 'team-a' },
				teamB: { id: 'team-b' },
				playerA: { id: 'player-a', teamId: 'team-b' },
				playerB: { id: 'player-b', teamId: 'team-b' }
			})
		).toThrow('再試合選手は対象チーム所属から選択してください');
	});

	test('rejects playerB outside the target team', () => {
		expect(() =>
			validateRankingTiebreakerSelection({
				teamA: { id: 'team-a' },
				teamB: { id: 'team-b' },
				playerA: { id: 'player-a', teamId: 'team-a' },
				playerB: { id: 'player-b', teamId: 'team-a' }
			})
		).toThrow('再試合選手は対象チーム所属から選択してください');
	});

	test('rejects a tiebreaker within the same team', () => {
		expect(() =>
			validateRankingTiebreakerSelection({
				teamA: { id: 'team-a' },
				teamB: { id: 'team-a' },
				playerA: { id: 'player-a', teamId: 'team-a' },
				playerB: { id: 'player-b', teamId: 'team-a' }
			})
		).toThrow('順位決定再試合は異なるチーム間で作成してください');
	});

	test.each([
		['teamA', { teamA: null }],
		['teamB', { teamB: null }],
		['playerA', { playerA: null }],
		['playerB', { playerB: null }]
	])('rejects when %s is missing', (_label, overrides) => {
		expect(() =>
			validateRankingTiebreakerSelection({
				teamA: { id: 'team-a' },
				teamB: { id: 'team-b' },
				playerA: { id: 'player-a', teamId: 'team-a' },
				playerB: { id: 'player-b', teamId: 'team-b' },
				...overrides
			})
		).toThrow('チームまたは選手が見つかりません');
	});
});
