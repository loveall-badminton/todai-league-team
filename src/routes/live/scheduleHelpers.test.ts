import { describe, expect, test } from 'vitest';
import { statusDot, statusText, groupTiesByPhase } from './scheduleHelpers';

// ─── statusDot ────────────────────────────────────────────────────────────────

describe('statusDot', () => {
	test('playing → emerald pulse class', () => {
		expect(statusDot('playing')).toBe('bg-emerald-500 animate-pulse');
	});

	test('finished → muted class', () => {
		expect(statusDot('finished')).toBe('bg-zinc-300');
	});

	test('confirmed → muted class', () => {
		expect(statusDot('confirmed')).toBe('bg-zinc-300');
	});

	test('forfeited → red class', () => {
		expect(statusDot('forfeited')).toBe('bg-red-300');
	});

	test('cancelled → red class', () => {
		expect(statusDot('cancelled')).toBe('bg-red-300');
	});

	test('scheduled → amber fallback', () => {
		expect(statusDot('scheduled')).toBe('bg-amber-400');
	});

	test('lineup_pending → amber fallback', () => {
		expect(statusDot('lineup_pending')).toBe('bg-amber-400');
	});

	test('unknown status → amber fallback', () => {
		expect(statusDot('something_unknown')).toBe('bg-amber-400');
	});
});

// ─── statusText ───────────────────────────────────────────────────────────────

describe('statusText', () => {
	test('playing → emerald bold class', () => {
		expect(statusText('playing')).toBe('text-emerald-700 font-medium');
	});

	test('finished → muted class', () => {
		expect(statusText('finished')).toBe('text-zinc-400');
	});

	test('confirmed → muted class', () => {
		expect(statusText('confirmed')).toBe('text-zinc-400');
	});

	test('scheduled → zinc-500 fallback', () => {
		expect(statusText('scheduled')).toBe('text-zinc-500');
	});

	test('unknown → zinc-500 fallback', () => {
		expect(statusText('unknown_status')).toBe('text-zinc-500');
	});
});

// ─── groupTiesByPhase ─────────────────────────────────────────────────────────

describe('groupTiesByPhase', () => {
	test('returns empty array for empty input', () => {
		expect(groupTiesByPhase([])).toEqual([]);
	});

	test('single tie → one group', () => {
		const result = groupTiesByPhase([{ phase: 'group_a', id: '1' }]);
		expect(result).toHaveLength(1);
		expect(result[0].phase).toBe('group_a');
		expect(result[0].ties).toHaveLength(1);
	});

	test('two ties with same phase → one group with both', () => {
		const ties = [
			{ phase: 'group_a', id: '1' },
			{ phase: 'group_a', id: '2' }
		];
		const result = groupTiesByPhase(ties);
		expect(result).toHaveLength(1);
		expect(result[0].ties).toHaveLength(2);
	});

	test('ties with different phases → separate groups', () => {
		const ties = [
			{ phase: 'group_a', id: '1' },
			{ phase: 'group_b', id: '2' },
			{ phase: 'semifinal', id: '3' }
		];
		const result = groupTiesByPhase(ties);
		expect(result).toHaveLength(3);
		expect(result.map((g) => g.phase)).toEqual(['group_a', 'group_b', 'semifinal']);
	});

	test('preserves insertion order of phases', () => {
		const ties = [
			{ phase: 'final', id: '3' },
			{ phase: 'group_a', id: '1' },
			{ phase: 'final', id: '4' }
		];
		const result = groupTiesByPhase(ties);
		expect(result[0].phase).toBe('final');
		expect(result[0].ties).toHaveLength(2);
		expect(result[1].phase).toBe('group_a');
	});

	test('preserves tie insertion order within a group', () => {
		const ties = [
			{ phase: 'group_a', id: 'x1' },
			{ phase: 'group_b', id: 'y1' },
			{ phase: 'group_a', id: 'x2' }
		];
		const result = groupTiesByPhase(ties);
		const ga = result.find((g) => g.phase === 'group_a')!;
		expect(ga.ties.map((t) => t.id)).toEqual(['x1', 'x2']);
	});

	test('extra properties on ties are preserved', () => {
		const ties = [{ phase: 'semifinal', id: 's1', teamAName: 'A', teamBName: 'B' }];
		const result = groupTiesByPhase(ties);
		expect(result[0].ties[0]).toMatchObject({ id: 's1', teamAName: 'A' });
	});
});
