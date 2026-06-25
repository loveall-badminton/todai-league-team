import { describe, expect, test } from 'vitest';
import {
	buildProgressionFromEvents,
	buildScoreProgressionSeries,
	filterScorePointsByGame,
	getScoreProgressionGameNos
} from './scoreProgression';
import type { ProgressionEvent } from './scoreProgression';

describe('buildProgressionFromEvents', () => {
	const rally = (seqNo: number, scoreA: number, scoreB: number): ProgressionEvent => ({
		type: 'rally_won',
		seqNo,
		gameNo: 1,
		scoreA,
		scoreB,
		targetSeqNo: null
	});

	const undo = (seqNo: number, targetSeqNo: number): ProgressionEvent => ({
		type: 'undo',
		seqNo,
		gameNo: null,
		scoreA: null,
		scoreB: null,
		targetSeqNo
	});

	const undoApplied = (seqNo: number, targetSeqNo: number): ProgressionEvent => ({
		type: 'undo_applied',
		seqNo,
		gameNo: null,
		scoreA: null,
		scoreB: null,
		targetSeqNo
	});

	test('no events returns empty array', () => {
		expect(buildProgressionFromEvents([])).toEqual([]);
	});

	test('all rally_won events are included when no undos', () => {
		const events = [rally(1, 1, 0), rally(2, 1, 1), rally(3, 2, 1)];
		const result = buildProgressionFromEvents(events);
		expect(result).toEqual([
			{ gameNo: 1, scoreA: 1, scoreB: 0 },
			{ gameNo: 1, scoreA: 1, scoreB: 1 },
			{ gameNo: 1, scoreA: 2, scoreB: 1 }
		]);
	});

	test('excludes the full range [targetSeqNo, undoSeqNo) when middle rally undone', () => {
		// Rally seqNo=2 (1-1) is undone → restores to (1-0), invalidating seqNo=3
		const events = [rally(1, 1, 0), rally(2, 1, 1), rally(3, 2, 1), undo(4, 2)];
		const result = buildProgressionFromEvents(events);
		expect(result).toEqual([
			{ gameNo: 1, scoreA: 1, scoreB: 0 }
			// seqNo=2 and seqNo=3 excluded
		]);
	});

	test('excludes only last rally when last rally undone', () => {
		const events = [rally(1, 1, 0), rally(2, 1, 1), undo(3, 2)];
		const result = buildProgressionFromEvents(events);
		expect(result).toEqual([{ gameNo: 1, scoreA: 1, scoreB: 0 }]);
	});

	test('new rally after undo is included', () => {
		const events = [rally(1, 1, 0), rally(2, 1, 1), undo(3, 2), rally(4, 2, 0)];
		const result = buildProgressionFromEvents(events);
		expect(result).toEqual([
			{ gameNo: 1, scoreA: 1, scoreB: 0 },
			{ gameNo: 1, scoreA: 2, scoreB: 0 }
		]);
	});

	test('multiple undos each exclude their range', () => {
		const events = [
			rally(1, 1, 0),
			rally(2, 1, 1),
			rally(3, 2, 1),
			undo(4, 2), // excludes seqNo 2,3
			rally(5, 1, 0), // re-scored from restored state
			undo(6, 5), // excludes seqNo 5
			rally(7, 1, 0)
		];
		const result = buildProgressionFromEvents(events);
		expect(result).toEqual([
			{ gameNo: 1, scoreA: 1, scoreB: 0 },
			// seqNo=7: re-scored after second undo
			{ gameNo: 1, scoreA: 1, scoreB: 0 }
		]);
	});

	test('undo_applied type from server works the same as undo', () => {
		const events = [rally(1, 1, 0), rally(2, 1, 1), rally(3, 2, 1), undoApplied(4, 2)];
		const result = buildProgressionFromEvents(events);
		expect(result).toEqual([{ gameNo: 1, scoreA: 1, scoreB: 0 }]);
	});

	test('handles large seqNo gaps without iterating every missing seqNo', () => {
		const events = [rally(1, 1, 0), rally(2_000_000, 1, 1), undoApplied(4_000_000, 2)];
		const result = buildProgressionFromEvents(events);
		expect(result).toEqual([{ gameNo: 1, scoreA: 1, scoreB: 0 }]);
	});

	test('non-rally events are ignored', () => {
		const events: ProgressionEvent[] = [
			{
				type: 'match_started',
				seqNo: 1,
				gameNo: null,
				scoreA: null,
				scoreB: null,
				targetSeqNo: null
			},
			rally(2, 1, 0)
		];
		const result = buildProgressionFromEvents(events);
		expect(result).toEqual([{ gameNo: 1, scoreA: 1, scoreB: 0 }]);
	});
});

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

describe('score progression helpers', () => {
	test('getScoreProgressionGameNos returns sorted unique game numbers', () => {
		expect(
			getScoreProgressionGameNos([
				{ gameNo: 2, scoreA: 1, scoreB: 0 },
				{ gameNo: 1, scoreA: 1, scoreB: 0 },
				{ gameNo: 2, scoreA: 2, scoreB: 0 }
			])
		).toEqual([1, 2]);
	});

	test('filterScorePointsByGame returns only the selected game', () => {
		expect(
			filterScorePointsByGame(
				[
					{ gameNo: 1, scoreA: 1, scoreB: 0 },
					{ gameNo: 2, scoreA: 1, scoreB: 1 },
					{ gameNo: 2, scoreA: 2, scoreB: 1 }
				],
				2
			)
		).toEqual([
			{ gameNo: 2, scoreA: 1, scoreB: 1 },
			{ gameNo: 2, scoreA: 2, scoreB: 1 }
		]);
	});

	test('filterScorePointsByGame returns the original array when game is null', () => {
		const points = [
			{ gameNo: 1, scoreA: 1, scoreB: 0 },
			{ gameNo: 2, scoreA: 1, scoreB: 1 }
		];
		expect(filterScorePointsByGame(points, null)).toEqual(points);
	});
});
