import { describe, expect, test } from 'vitest';
import { validateRankingTiebreakerSelection } from './rankingTiebreakerService';

describe('validateRankingTiebreakerSelection', () => {
	test('accepts one player from each target team', () => {
		expect(() =>
			validateRankingTiebreakerSelection({
				teamA: { id: 'team-a' },
				teamB: { id: 'team-b' },
				playerA: { id: 'player-a', teamId: 'team-a' },
				playerB: { id: 'player-b', teamId: 'team-b' }
			})
		).not.toThrow();
	});

	test('rejects a player outside the target team', () => {
		expect(() =>
			validateRankingTiebreakerSelection({
				teamA: { id: 'team-a' },
				teamB: { id: 'team-b' },
				playerA: { id: 'player-a', teamId: 'team-b' },
				playerB: { id: 'player-b', teamId: 'team-b' }
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
});
