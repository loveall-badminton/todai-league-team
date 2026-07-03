import { describe, expect, test } from 'vitest';
import {
	isActiveMatchStatus,
	isConfirmableMatchStatus,
	isResultMatchStatus,
	isTerminalMatchStatus,
	isTerminalRubberStatus,
	rubberStatusForMatchStatus
} from './matchStatus';

describe('match status classification', () => {
	test('terminal statuses cover all end states', () => {
		for (const status of ['finished', 'forfeited', 'retired', 'confirmed', 'cancelled']) {
			expect(isTerminalMatchStatus(status)).toBe(true);
		}
		for (const status of ['scheduled', 'playing', 'interval', 'suspended']) {
			expect(isTerminalMatchStatus(status)).toBe(false);
		}
	});

	test('active statuses include interval and suspension', () => {
		for (const status of ['playing', 'interval', 'suspended']) {
			expect(isActiveMatchStatus(status)).toBe(true);
		}
		for (const status of ['scheduled', 'finished', 'confirmed', 'cancelled']) {
			expect(isActiveMatchStatus(status)).toBe(false);
		}
	});

	test('confirmable statuses are result statuses before confirmation', () => {
		for (const status of ['finished', 'forfeited', 'retired']) {
			expect(isConfirmableMatchStatus(status)).toBe(true);
			expect(isResultMatchStatus(status)).toBe(true);
		}
		expect(isConfirmableMatchStatus('confirmed')).toBe(false);
		expect(isResultMatchStatus('confirmed')).toBe(true);
		expect(isResultMatchStatus('cancelled')).toBe(false);
		expect(isResultMatchStatus('playing')).toBe(false);
	});
});

describe('rubberStatusForMatchStatus', () => {
	test('projects match statuses onto rubber statuses', () => {
		expect(rubberStatusForMatchStatus('confirmed')).toBe('confirmed');
		expect(rubberStatusForMatchStatus('finished')).toBe('finished');
		expect(rubberStatusForMatchStatus('forfeited')).toBe('finished');
		expect(rubberStatusForMatchStatus('retired')).toBe('finished');
		expect(rubberStatusForMatchStatus('playing')).toBe('playing');
		expect(rubberStatusForMatchStatus('interval')).toBe('playing');
		expect(rubberStatusForMatchStatus('suspended')).toBe('playing');
		expect(rubberStatusForMatchStatus('scheduled')).toBe('scheduled');
		expect(rubberStatusForMatchStatus('called')).toBe('scheduled');
		expect(rubberStatusForMatchStatus('warmup')).toBe('scheduled');
		expect(rubberStatusForMatchStatus('cancelled')).toBe('cancelled');
	});

	test('returns null for unknown statuses', () => {
		expect(rubberStatusForMatchStatus('unknown')).toBeNull();
	});
});

describe('terminal rubber statuses', () => {
	test('counts skipped and cancelled rubbers as consumed', () => {
		for (const status of ['finished', 'confirmed', 'skipped', 'cancelled']) {
			expect(isTerminalRubberStatus(status)).toBe(true);
		}
		for (const status of ['not_ready', 'ready', 'scheduled', 'playing']) {
			expect(isTerminalRubberStatus(status)).toBe(false);
		}
	});
});
