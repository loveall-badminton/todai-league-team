import { describe, expect, test } from 'vitest';
import {
	normalizeAccountId,
	accountIdToInternalEmail,
	displayAccountId,
	INTERNAL_EMAIL_DOMAIN
} from './accountIds';

// ─── normalizeAccountId ──────────────────────────────────────────────────────

describe('normalizeAccountId', () => {
	test('accepts a valid lowercase alphanumeric ID', () => {
		expect(normalizeAccountId('alice')).toBe('alice');
	});

	test('normalises uppercase to lowercase', () => {
		expect(normalizeAccountId('Alice123')).toBe('alice123');
	});

	test('accepts IDs containing dots, underscores, and hyphens', () => {
		expect(normalizeAccountId('a.b_c-d')).toBe('a.b_c-d');
	});

	test('accepts exactly 3-character IDs (minimum length)', () => {
		expect(normalizeAccountId('abc')).toBe('abc');
	});

	test('accepts exactly 64-character IDs (maximum length)', () => {
		const id = 'a'.repeat(64);
		expect(normalizeAccountId(id)).toBe(id);
	});

	test('trims surrounding whitespace before validation', () => {
		expect(normalizeAccountId('  alice  ')).toBe('alice');
	});

	test('throws for IDs shorter than 3 characters', () => {
		expect(() => normalizeAccountId('ab')).toThrow();
	});

	test('throws for IDs longer than 64 characters', () => {
		expect(() => normalizeAccountId('a'.repeat(65))).toThrow();
	});

	test('throws for empty string', () => {
		expect(() => normalizeAccountId('')).toThrow();
	});

	test('throws for null (null is coerced to empty string via ?? operator)', () => {
		// The implementation uses `String(raw ?? '')` so null → '' → throws
		expect(() => normalizeAccountId(null)).toThrow();
	});

	test('throws for IDs containing spaces', () => {
		expect(() => normalizeAccountId('hello world')).toThrow();
	});

	test('throws for IDs containing uppercase-only after trim when they include invalid chars', () => {
		expect(() => normalizeAccountId('hello@world')).toThrow();
	});

	test('throws for IDs starting with or containing only special characters', () => {
		expect(() => normalizeAccountId('!!!')).toThrow();
	});
});

// ─── accountIdToInternalEmail ────────────────────────────────────────────────

describe('accountIdToInternalEmail', () => {
	test('appends the internal email domain', () => {
		expect(accountIdToInternalEmail('alice')).toBe(`alice@${INTERNAL_EMAIL_DOMAIN}`);
	});

	test('preserves dots and hyphens in the local part', () => {
		expect(accountIdToInternalEmail('team.abc-1')).toBe(`team.abc-1@${INTERNAL_EMAIL_DOMAIN}`);
	});
});

// ─── displayAccountId ────────────────────────────────────────────────────────

describe('displayAccountId', () => {
	test('prefers displayUsername when present', () => {
		const user = {
			id: 'u1',
			displayUsername: 'DisplayName',
			username: 'username',
			email: `alice@${INTERNAL_EMAIL_DOMAIN}`
		};
		expect(displayAccountId(user)).toBe('DisplayName');
	});

	test('falls back to username when displayUsername is absent', () => {
		const user = {
			id: 'u1',
			displayUsername: null,
			username: 'alice',
			email: `other@${INTERNAL_EMAIL_DOMAIN}`
		};
		expect(displayAccountId(user)).toBe('alice');
	});

	test('strips internal domain suffix from email when username is absent', () => {
		const user = {
			id: 'u1',
			displayUsername: null,
			username: null,
			email: `bob@${INTERNAL_EMAIL_DOMAIN}`
		};
		expect(displayAccountId(user)).toBe('bob');
	});

	test('returns email as-is when it does not end with internal domain', () => {
		const user = {
			id: 'u1',
			displayUsername: null,
			username: null,
			email: 'bob@gmail.com'
		};
		expect(displayAccountId(user)).toBe('bob@gmail.com');
	});

	test('returns empty string when all identifier fields are null/undefined', () => {
		const user = {
			id: 'u1',
			displayUsername: null,
			username: null,
			email: null
		};
		expect(displayAccountId(user)).toBe('');
	});
});
