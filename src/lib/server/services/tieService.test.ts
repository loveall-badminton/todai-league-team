import { describe, expect, test } from 'vitest';
import { generateRoundRobinPairs, inferLineupDueAt } from './tieService';

describe('inferLineupDueAt', () => {
	test('returns null when scheduledStartAt is null', () => {
		expect(inferLineupDueAt(null, 10, 'ten_minutes_before')).toBeNull();
	});

	test('returns null for manual policy', () => {
		expect(inferLineupDueAt('2025-06-01T10:00:00.000Z', 10, 'manual')).toBeNull();
	});

	test('returns null for first_match_before_opening policy', () => {
		expect(
			inferLineupDueAt('2025-06-01T10:00:00.000Z', 10, 'first_match_before_opening')
		).toBeNull();
	});

	test('returns null for invalid date string', () => {
		expect(inferLineupDueAt('not-a-date', 10, 'ten_minutes_before')).toBeNull();
	});

	test('subtracts defaultMinutesBefore from scheduledStartAt', () => {
		const result = inferLineupDueAt('2025-06-01T10:00:00.000Z', 10, 'ten_minutes_before');
		expect(result).toBe('2025-06-01T09:50:00.000Z');
	});

	test('subtracts 0 minutes when defaultMinutesBefore is 0', () => {
		const result = inferLineupDueAt('2025-06-01T10:00:00.000Z', 0, 'ten_minutes_before');
		expect(result).toBe('2025-06-01T10:00:00.000Z');
	});

	test('applies default ten_minutes_before policy when policy is undefined', () => {
		const result = inferLineupDueAt('2025-06-01T10:00:00.000Z', 15, undefined);
		expect(result).toBe('2025-06-01T09:45:00.000Z');
	});
});

describe('generateRoundRobinPairs', () => {
	test('returns empty array for 0 teams', () => {
		expect(generateRoundRobinPairs([])).toEqual([]);
	});

	test('returns empty array for 1 team', () => {
		expect(generateRoundRobinPairs(['A'])).toEqual([]);
	});

	test('returns 1 pair for 2 teams', () => {
		const pairs = generateRoundRobinPairs(['A', 'B']);
		expect(pairs).toHaveLength(1);
		expect(pairs).toContainEqual(['A', 'B']);
	});

	test('returns 3 pairs for 3 teams (A-B, A-C, B-C)', () => {
		const pairs = generateRoundRobinPairs(['A', 'B', 'C']);
		expect(pairs).toHaveLength(3);
		expect(pairs).toContainEqual(['A', 'B']);
		expect(pairs).toContainEqual(['A', 'C']);
		expect(pairs).toContainEqual(['B', 'C']);
	});

	test('returns 6 pairs for 4 teams', () => {
		const pairs = generateRoundRobinPairs(['A', 'B', 'C', 'D']);
		expect(pairs).toHaveLength(6);
	});

	test('does not generate reversed duplicates (A-B only, not also B-A)', () => {
		const pairs = generateRoundRobinPairs(['A', 'B', 'C']);
		const hasAB = pairs.some(([a, b]) => a === 'A' && b === 'B');
		const hasBA = pairs.some(([a, b]) => a === 'B' && b === 'A');
		expect(hasAB).toBe(true);
		expect(hasBA).toBe(false);
	});

	test('each team appears as teamA in some pair', () => {
		const teams = ['A', 'B', 'C'];
		const pairs = generateRoundRobinPairs(teams);
		expect(pairs.some(([a]) => a === 'A')).toBe(true);
		expect(pairs.some(([a]) => a === 'B')).toBe(true);
	});

	test('works with objects (identity by reference)', () => {
		const teams = [{ id: '1' }, { id: '2' }, { id: '3' }];
		const pairs = generateRoundRobinPairs(teams);
		expect(pairs).toHaveLength(3);
		expect(pairs[0]).toEqual([{ id: '1' }, { id: '2' }]);
	});
});
