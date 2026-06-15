import { describe, expect, test } from 'vitest';
import { safeRedirectTo } from './redirectUtils';

describe('safeRedirectTo', () => {
	test('passes through a normal relative path starting with /', () => {
		expect(safeRedirectTo('/dashboard')).toBe('/dashboard');
	});

	test('passes through the root path /', () => {
		expect(safeRedirectTo('/')).toBe('/');
	});

	test('passes through a path with query string', () => {
		expect(safeRedirectTo('/ties?filter=playing')).toBe('/ties?filter=playing');
	});

	test('passes through a deeply nested path', () => {
		expect(safeRedirectTo('/ties/abc-123/lineups')).toBe('/ties/abc-123/lineups');
	});

	test('rejects protocol-relative URLs starting with //', () => {
		expect(safeRedirectTo('//evil.example.com')).toBe('/');
	});

	test('rejects http:// external URLs', () => {
		expect(safeRedirectTo('http://evil.example.com')).toBe('/');
	});

	test('rejects https:// external URLs', () => {
		expect(safeRedirectTo('https://evil.example.com/steal')).toBe('/');
	});

	test('returns / for null', () => {
		expect(safeRedirectTo(null)).toBe('/');
	});

	test('returns / for empty string', () => {
		expect(safeRedirectTo('')).toBe('/');
	});

	test('accepts a FormDataEntryValue (string subtype)', () => {
		// FormDataEntryValue is string | File; passing a plain string covers the string branch.
		expect(safeRedirectTo('/settings' as FormDataEntryValue)).toBe('/settings');
	});
});
