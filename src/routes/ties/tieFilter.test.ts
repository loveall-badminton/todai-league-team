import { describe, expect, test } from 'vitest';
import { tieMatchesFilter, VALID_TIE_FILTERS, type TieFilter } from './tieFilter';

const tie = (phase: string, status: string, scheduleChanged = false) => ({
	phase,
	status,
	scheduleChanged
});

describe('tieMatchesFilter', () => {
	// ─── 'all' filter ─────────────────────────────────────────────────────────

	test('all: always returns true regardless of tie data', () => {
		expect(tieMatchesFilter(tie('group_a', 'playing'), 'all')).toBe(true);
		expect(tieMatchesFilter(tie('final', 'confirmed'), 'all')).toBe(true);
	});

	// ─── phase filters ────────────────────────────────────────────────────────

	test.each([
		['group_a', 'group_a'],
		['group_b', 'group_b'],
		['semifinal', 'semifinal'],
		['final', 'final'],
		['third_place', 'third_place'],
		['fifth_place', 'fifth_place']
	] as [TieFilter, string][])(
		'filter=%s matches tie with phase=%s and rejects others',
		(filter, phase) => {
			expect(tieMatchesFilter(tie(phase, 'playing'), filter)).toBe(true);
			expect(tieMatchesFilter(tie('other_phase', 'playing'), filter)).toBe(false);
		}
	);

	// ─── status filters ───────────────────────────────────────────────────────

	test('lineup_pending: matches only when status is lineup_pending', () => {
		expect(tieMatchesFilter(tie('group_a', 'lineup_pending'), 'lineup_pending')).toBe(true);
		expect(tieMatchesFilter(tie('group_a', 'playing'), 'lineup_pending')).toBe(false);
	});

	test('playing: matches only when status is playing', () => {
		expect(tieMatchesFilter(tie('group_a', 'playing'), 'playing')).toBe(true);
		expect(tieMatchesFilter(tie('group_a', 'finished'), 'playing')).toBe(false);
	});

	test('finished: matches only when status is finished', () => {
		expect(tieMatchesFilter(tie('group_a', 'finished'), 'finished')).toBe(true);
		expect(tieMatchesFilter(tie('group_a', 'confirmed'), 'finished')).toBe(false);
	});

	// ─── schedule_changed filter ──────────────────────────────────────────────

	test('schedule_changed: matches when scheduleChanged is true', () => {
		expect(tieMatchesFilter(tie('group_a', 'scheduled', true), 'schedule_changed')).toBe(true);
	});

	test('schedule_changed: rejects when scheduleChanged is false', () => {
		expect(tieMatchesFilter(tie('group_a', 'playing', false), 'schedule_changed')).toBe(false);
	});

	// ─── no cross-contamination ───────────────────────────────────────────────

	test('a group_a phase tie does not match group_b filter', () => {
		expect(tieMatchesFilter(tie('group_a', 'playing'), 'group_b')).toBe(false);
	});

	test('a finished status tie does not match playing filter', () => {
		expect(tieMatchesFilter(tie('group_a', 'finished'), 'playing')).toBe(false);
	});

	// ─── VALID_TIE_FILTERS completeness ───────────────────────────────────────

	test('VALID_TIE_FILTERS contains all 11 filter values', () => {
		expect(VALID_TIE_FILTERS).toHaveLength(11);
		expect(VALID_TIE_FILTERS).toContain('all');
		expect(VALID_TIE_FILTERS).toContain('schedule_changed');
	});
});
