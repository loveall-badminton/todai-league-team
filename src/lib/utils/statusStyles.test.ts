import { describe, expect, test } from 'vitest';
import { statusBadgeColor, groupBadgeColor } from './statusStyles';

// ─── statusBadgeColor ────────────────────────────────────────────────────────

describe('statusBadgeColor', () => {
	test('maps tie/match lifecycle statuses to the expected colours', () => {
		expect(statusBadgeColor('scheduled')).toBe('zinc');
		expect(statusBadgeColor('lineup_pending')).toBe('amber');
		expect(statusBadgeColor('lineup_submitted')).toBe('blue');
		expect(statusBadgeColor('ready')).toBe('violet');
		expect(statusBadgeColor('called')).toBe('blue');
		expect(statusBadgeColor('warmup')).toBe('violet');
		expect(statusBadgeColor('playing')).toBe('green');
		expect(statusBadgeColor('interval')).toBe('amber');
		expect(statusBadgeColor('suspended')).toBe('amber');
		expect(statusBadgeColor('finished')).toBe('orange');
		expect(statusBadgeColor('forfeited')).toBe('red');
		expect(statusBadgeColor('retired')).toBe('red');
		expect(statusBadgeColor('confirmed')).toBe('emerald');
		expect(statusBadgeColor('cancelled')).toBe('red');
	});

	test('maps rubber-specific statuses', () => {
		expect(statusBadgeColor('not_ready')).toBe('zinc');
		expect(statusBadgeColor('skipped')).toBe('zinc');
	});

	test('maps submission statuses', () => {
		expect(statusBadgeColor('submitted')).toBe('blue');
		expect(statusBadgeColor('locked')).toBe('violet');
		expect(statusBadgeColor('revealed')).toBe('emerald');
		expect(statusBadgeColor('draft')).toBe('zinc');
	});

	test('returns zinc for null', () => {
		expect(statusBadgeColor(null)).toBe('zinc');
	});

	test('returns zinc for undefined', () => {
		expect(statusBadgeColor(undefined)).toBe('zinc');
	});

	test('returns zinc for an unknown status string', () => {
		expect(statusBadgeColor('totally_unknown')).toBe('zinc');
	});
});

// ─── groupBadgeColor ─────────────────────────────────────────────────────────

describe('groupBadgeColor', () => {
	test('returns blue for group A', () => {
		expect(groupBadgeColor('A')).toBe('blue');
	});

	test('returns violet for group B', () => {
		expect(groupBadgeColor('B')).toBe('violet');
	});

	test('returns zinc for null (no group / finals)', () => {
		expect(groupBadgeColor(null)).toBe('zinc');
	});

	test('returns zinc for any other value', () => {
		expect(groupBadgeColor('C')).toBe('zinc');
	});
});
