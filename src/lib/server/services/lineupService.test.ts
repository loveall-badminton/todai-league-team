import { describe, expect, test } from 'vitest';
import { validateLineupRules } from './lineupService';
import type { RubberCode } from '$lib/domain/tokyoLeague';

const item = (rubberCode: RubberCode, player1Id: string, player2Id: string) => ({
	rubberCode,
	player1Id,
	player2Id
});

const players = [
	{ id: 'm1', teamId: 'team-a', gender: 'male' as const },
	{ id: 'm2', teamId: 'team-a', gender: 'male' as const },
	{ id: 'f1', teamId: 'team-a', gender: 'female' as const },
	{ id: 'f2', teamId: 'team-a', gender: 'female' as const }
];

describe('validateLineupRules', () => {
	test('errors on discipline gender mismatch', () => {
		const errors = validateLineupRules(
			[item('WD1', 'f1', 'm1'), item('XD1', 'm1', 'm2'), item('MD1', 'm1', 'f2')],
			players
		);

		expect(errors).toEqual(
			expect.arrayContaining([
				'女子ダブルスに男性が含まれています',
				'ミックスダブルスが男女ペアではありません',
				'男子ダブルス1に女性が含まれています'
			])
		);
	});

	test('errors when a player appears in multiple rubbers', () => {
		const errors = validateLineupRules([item('WD1', 'f1', 'f2'), item('XD1', 'm1', 'f1')], players);

		expect(errors).toContain('同一選手が複数種目に出場しています');
	});

	test('no errors for a gender-correct lineup with unique players', () => {
		const errors = validateLineupRules(
			[
				item('WD1', 'f1', 'f2'),
				item('XD1', 'm1', 'f1'),
				item('MD3', 'm1', 'm2'),
				item('MD2', 'm1', 'm2'),
				item('MD1', 'm1', 'm2')
			],
			players
		);

		expect(errors).not.toContain('女子ダブルスに男性が含まれています');
		expect(errors).not.toContain('ミックスダブルスが男女ペアではありません');
		expect(errors).not.toContain('男子ダブルス1に女性が含まれています');
	});

	test('MD2 and MD3 also error when a female player is included', () => {
		const errors = validateLineupRules([item('MD3', 'm1', 'f1'), item('MD2', 'f2', 'm2')], players);

		expect(errors).toContain('男子ダブルス3に女性が含まれています');
		expect(errors).toContain('男子ダブルス2に女性が含まれています');
	});

	test('XD1 with two females errors about gender pair', () => {
		const errors = validateLineupRules([item('XD1', 'f1', 'f2')], players);

		expect(errors).toContain('ミックスダブルスが男女ペアではありません');
	});

	test('XD1 with one male and one female produces no gender error', () => {
		const errors = validateLineupRules([item('XD1', 'm1', 'f1')], players);

		expect(errors).not.toContain('ミックスダブルスが男女ペアではありません');
	});

	test('skips validation for items whose player ids are not in the players list', () => {
		const errors = validateLineupRules([item('WD1', 'unknown-1', 'unknown-2')], players);

		expect(errors).not.toContain('女子ダブルスに男性が含まれています');
	});
});
