import { describe, expect, test } from 'vitest';
import { buildScoreProgressionSeries } from './scoreProgression';

describe('buildScoreProgressionSeries', () => {
	// ─── empty input ──────────────────────────────────────────────────────────

	test('returns null for empty points array', () => {
		expect(buildScoreProgressionSeries([])).toBeNull();
	});

	// ─── origin prepend ───────────────────────────────────────────────────────

	test('prepends (0,0) origin to both series', () => {
		const result = buildScoreProgressionSeries([{ gameNo: 1, scoreA: 1, scoreB: 0 }]);
		expect(result?.a[0]).toEqual({ x: 0, y: 0 });
		expect(result?.b[0]).toEqual({ x: 0, y: 0 });
	});

	// ─── single rally ─────────────────────────────────────────────────────────

	test('single point produces series of length 2 (origin + point)', () => {
		const result = buildScoreProgressionSeries([{ gameNo: 1, scoreA: 1, scoreB: 0 }]);
		expect(result?.a).toHaveLength(2);
		expect(result?.b).toHaveLength(2);
		expect(result?.a[1]).toEqual({ x: 1, y: 1 });
		expect(result?.b[1]).toEqual({ x: 1, y: 0 });
	});

	// ─── deduplication ────────────────────────────────────────────────────────

	test('removes consecutive entries where neither score changed', () => {
		const result = buildScoreProgressionSeries([
			{ gameNo: 1, scoreA: 1, scoreB: 0 },
			{ gameNo: 1, scoreA: 1, scoreB: 0 }, // duplicate
			{ gameNo: 1, scoreA: 2, scoreB: 0 }
		]);
		// origin + 2 unique entries = 3
		expect(result?.a).toHaveLength(3);
		expect(result?.a.map((p) => p.y)).toEqual([0, 1, 2]);
	});

	test('keeps first entry even if followed by a duplicate', () => {
		const result = buildScoreProgressionSeries([
			{ gameNo: 1, scoreA: 1, scoreB: 0 },
			{ gameNo: 1, scoreA: 1, scoreB: 0 }
		]);
		expect(result?.a).toHaveLength(2); // origin + 1
	});

	test('does not remove entries where only one score changed', () => {
		const result = buildScoreProgressionSeries([
			{ gameNo: 1, scoreA: 1, scoreB: 0 },
			{ gameNo: 1, scoreA: 1, scoreB: 1 } // scoreB changed
		]);
		expect(result?.a).toHaveLength(3); // origin + 2
	});

	// ─── last game filtering ──────────────────────────────────────────────────

	test('includes only the last game number', () => {
		const result = buildScoreProgressionSeries([
			{ gameNo: 1, scoreA: 21, scoreB: 15 },
			{ gameNo: 2, scoreA: 5, scoreB: 3 }
		]);
		// Game 2 only: origin + (5,3) = 2 entries
		expect(result?.a).toHaveLength(2);
		expect(result?.a[1]).toEqual({ x: 1, y: 5 });
		expect(result?.b[1]).toEqual({ x: 1, y: 3 });
	});

	test('all-game-1 input is treated as single game', () => {
		const result = buildScoreProgressionSeries([
			{ gameNo: 1, scoreA: 1, scoreB: 0 },
			{ gameNo: 1, scoreA: 2, scoreB: 0 },
			{ gameNo: 1, scoreA: 2, scoreB: 1 }
		]);
		expect(result?.a).toHaveLength(4); // origin + 3 unique
	});

	// ─── x-index monotonically increases ─────────────────────────────────────

	test('x values are consecutive integers starting from 0', () => {
		const result = buildScoreProgressionSeries([
			{ gameNo: 1, scoreA: 1, scoreB: 0 },
			{ gameNo: 1, scoreA: 2, scoreB: 0 },
			{ gameNo: 1, scoreA: 3, scoreB: 0 }
		]);
		expect(result?.a.map((p) => p.x)).toEqual([0, 1, 2, 3]);
		expect(result?.b.map((p) => p.x)).toEqual([0, 1, 2, 3]);
	});

	// ─── series a and b share x ───────────────────────────────────────────────

	test('series a and b have the same x values', () => {
		const result = buildScoreProgressionSeries([
			{ gameNo: 1, scoreA: 5, scoreB: 3 },
			{ gameNo: 1, scoreA: 6, scoreB: 3 }
		]);
		const xA = result?.a.map((p) => p.x);
		const xB = result?.b.map((p) => p.x);
		expect(xA).toEqual(xB);
	});

	// ─── realistic score progression ─────────────────────────────────────────

	test('realistic game-2 sequence with game-1 history', () => {
		const result = buildScoreProgressionSeries([
			// Game 1 (ignored)
			{ gameNo: 1, scoreA: 21, scoreB: 15 },
			// Game 2
			{ gameNo: 2, scoreA: 1, scoreB: 0 },
			{ gameNo: 2, scoreA: 1, scoreB: 1 },
			{ gameNo: 2, scoreA: 2, scoreB: 1 }
		]);
		expect(result?.a.map((p) => p.y)).toEqual([0, 1, 1, 2]);
		expect(result?.b.map((p) => p.y)).toEqual([0, 0, 1, 1]);
	});
});
