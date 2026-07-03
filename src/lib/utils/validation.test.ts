import { describe, expect, test } from 'vitest';
import { emptyToNull, uniqueNonEmpty, venueOrNull } from './validation';

describe('emptyToNull', () => {
	test.each([
		['  alice  ', 'alice'],
		['x', 'x'],
		['', null],
		['   ', null],
		[null, null],
		[undefined, null]
	])('converts %s to %s', (input, expected) => {
		expect(emptyToNull(input)).toBe(expected);
	});
});

describe('uniqueNonEmpty', () => {
	test('trims values, removes empties, and deduplicates while preserving first occurrence order', () => {
		expect(uniqueNonEmpty([' alice ', '', 'bob', 'alice', '  bob  ', 'carol', '  '])).toEqual([
			'alice',
			'bob',
			'carol'
		]);
	});

	test('returns an empty array for undefined input', () => {
		expect(uniqueNonEmpty(undefined)).toEqual([]);
	});
});

describe('venueOrNull', () => {
	test.each([
		['first_gym', 'first_gym'],
		['second_gym', 'second_gym'],
		['other', null],
		['', null],
		[null, null],
		[undefined, null]
	])('maps %s to %s', (input, expected) => {
		expect(venueOrNull(input)).toBe(expected);
	});
});
