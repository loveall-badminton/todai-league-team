import { describe, expect, test } from 'vitest';
import * as v from 'valibot';
import { parseSearchParams, searchParamsToObject, updateUrlSearchParams } from './searchParams';

describe('searchParams utils', () => {
	const schema = v.object({
		filter: v.optional(v.picklist(['all', 'playing'] as const), 'all')
	});

	test('parses URLSearchParams with a valibot schema', () => {
		const parsed = parseSearchParams(new URLSearchParams('filter=playing'), schema, {
			filter: 'all'
		});

		expect(parsed).toEqual({ filter: 'playing' });
	});

	test('returns fallback for invalid search params', () => {
		const parsed = parseSearchParams(new URLSearchParams('filter=unknown'), schema, {
			filter: 'all'
		});

		expect(parsed).toEqual({ filter: 'all' });
	});

	test('keeps repeated keys as arrays before validation', () => {
		expect(searchParamsToObject(new URLSearchParams('tag=a&tag=b'))).toEqual({
			tag: ['a', 'b']
		});
	});

	test('updates a URL only with schema-valid values', () => {
		const url = updateUrlSearchParams(new URL('https://example.test/ties?page=2'), schema, {
			filter: 'playing'
		});

		expect(url?.href).toBe('https://example.test/ties?page=2&filter=playing');
	});

	test('can omit validated values while updating', () => {
		const url = updateUrlSearchParams(
			new URL('https://example.test/ties?filter=playing&page=2'),
			schema,
			{ filter: 'all' },
			{ omit: (key, value) => key === 'filter' && value === 'all' }
		);

		expect(url?.href).toBe('https://example.test/ties?page=2');
	});

	test('returns null for invalid update values', () => {
		expect(
			updateUrlSearchParams(new URL('https://example.test/ties'), schema, { filter: 'invalid' })
		).toBeNull();
	});
});
