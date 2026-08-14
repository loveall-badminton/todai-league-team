import { describe, expect, test } from 'vitest';
import {
	groupPhaseFor,
	isGroupPhase,
	RUBBER_DEFINITIONS,
	TOKYO_LEAGUE_SCORING_RULES
} from './tokyoLeague';

describe('tokyo league constants', () => {
	test('rubber definitions are fixed in operation order', () => {
		expect(RUBBER_DEFINITIONS).toHaveLength(5);
		expect(RUBBER_DEFINITIONS.map((rubber) => rubber.code)).toEqual([
			'WD1',
			'XD1',
			'MD3',
			'MD2',
			'MD1'
		]);
		expect(RUBBER_DEFINITIONS.map((rubber) => rubber.discipline)).toEqual([
			'WD',
			'XD',
			'MD',
			'MD',
			'MD'
		]);
		expect(RUBBER_DEFINITIONS.map((rubber) => rubber.displayOrder)).toEqual([1, 2, 3, 4, 5]);
	});

	test('default scoring rules include group, knockout, and tiebreaker configs', () => {
		expect(TOKYO_LEAGUE_SCORING_RULES.map((rule) => rule.code)).toEqual([
			'GROUP_15',
			'KNOCKOUT_21',
			'TIEBREAKER_21_SINGLE_GAME'
		]);
		expect(TOKYO_LEAGUE_SCORING_RULES.find((rule) => rule.code === 'GROUP_15')).toMatchObject({
			pointsToWin: 15,
			maxPoints: 21,
			midGameIntervalPoint: 8
		});
		expect(
			TOKYO_LEAGUE_SCORING_RULES.find((rule) => rule.code === 'TIEBREAKER_21_SINGLE_GAME')
		).toMatchObject({
			maxGames: 1,
			gamesToWin: 1
		});
	});

	test('group phase mapping is stable', () => {
		expect(groupPhaseFor('A')).toBe('group_a');
		expect(groupPhaseFor('B')).toBe('group_b');
	});

	test('isGroupPhase recognizes group phases', () => {
		expect(isGroupPhase('group_a')).toBe(true);
		expect(isGroupPhase('group_b')).toBe(true);
		expect(isGroupPhase('final')).toBe(false);
		expect(isGroupPhase('semifinal')).toBe(false);
	});
});
