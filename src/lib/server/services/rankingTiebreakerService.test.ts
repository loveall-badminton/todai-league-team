import { describe, expect, test } from 'vitest';
import { validateRankingTiebreakerSelection } from './rankingTiebreakerService';

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
