import { describe, expect, test } from 'vitest';
import { formatDurationMin, parseHhMm, subtractMinutesFromHhMm, toTimestamp } from './timeOfDay';

describe('parseHhMm', () => {
	test('parses valid HH:mm strings', () => {
		expect(parseHhMm('08:30')).toEqual({ hours: 8, minutes: 30 });
		expect(parseHhMm('8:30')).toEqual({ hours: 8, minutes: 30 });
		expect(parseHhMm('23:59')).toEqual({ hours: 23, minutes: 59 });
		expect(parseHhMm('00:00')).toEqual({ hours: 0, minutes: 0 });
	});

	test('rejects non-HH:mm strings', () => {
		expect(parseHhMm('24:00')).toBeNull();
		expect(parseHhMm('08:60')).toBeNull();
		expect(parseHhMm('2025-06-01T10:00:00.000Z')).toBeNull();
		expect(parseHhMm('abc')).toBeNull();
		expect(parseHhMm('')).toBeNull();
	});
});

describe('toTimestamp', () => {
	test('interprets HH:mm as the same local day as the base timestamp', () => {
		const base = new Date(2026, 6, 4, 12, 0).getTime();
		const result = toTimestamp('08:30', base);
		expect(result).toBe(new Date(2026, 6, 4, 8, 30).getTime());
	});

	test('parses ISO datetime strings', () => {
		expect(toTimestamp('2026-07-04T08:30:00.000Z')).toBe(Date.parse('2026-07-04T08:30:00.000Z'));
	});

	test('returns null for unparseable values', () => {
		expect(toTimestamp('not-a-date')).toBeNull();
	});
});

describe('subtractMinutesFromHhMm', () => {
	test('subtracts minutes within the same day', () => {
		expect(subtractMinutesFromHhMm('08:30', 10)).toBe('08:20');
		expect(subtractMinutesFromHhMm('08:30', 0)).toBe('08:30');
	});

	test('wraps around midnight', () => {
		expect(subtractMinutesFromHhMm('00:05', 10)).toBe('23:55');
	});

	test('returns null for non-HH:mm input', () => {
		expect(subtractMinutesFromHhMm('2025-06-01T10:00:00.000Z', 10)).toBeNull();
	});
});

describe('formatDurationMin', () => {
	test('under an hour stays in minutes', () => {
		expect(formatDurationMin(1)).toBe('1分');
		expect(formatDurationMin(59)).toBe('59分');
	});

	test('exact hours omit minutes', () => {
		expect(formatDurationMin(60)).toBe('1時間');
		expect(formatDurationMin(120)).toBe('2時間');
	});

	test('hours and minutes combined', () => {
		expect(formatDurationMin(61)).toBe('1時間1分');
		expect(formatDurationMin(150)).toBe('2時間30分');
	});
});
