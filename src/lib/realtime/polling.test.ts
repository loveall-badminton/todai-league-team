import { describe, expect, test, vi } from 'vitest';
import { computePollDelay } from './polling';

describe('computePollDelay', () => {
	test('adds jitter on top of the base interval', () => {
		vi.spyOn(Math, 'random').mockReturnValue(0.5);
		expect(computePollDelay(8_000)).toBe(10_000);
	});

	test('stays within the configured jitter range', () => {
		vi.spyOn(Math, 'random').mockReturnValue(0);
		expect(computePollDelay(10_000)).toBe(10_000);

		vi.spyOn(Math, 'random').mockReturnValue(1);
		expect(computePollDelay(10_000)).toBe(15_000);
	});

	test('returns 0 for invalid base intervals', () => {
		expect(computePollDelay(0)).toBe(0);
		expect(computePollDelay(Number.NaN)).toBe(0);
	});
});
