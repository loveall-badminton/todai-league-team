import { ShieldCheck, UserRound, UsersRound } from '@lucide/svelte';
import { describe, expect, test } from 'vitest';
import {
	accountTypeBadgeColor,
	accountTypeIcon,
	accountTypeLabel,
	accountTypeValue
} from './accounts.helpers';

describe('accountTypeValue', () => {
	test('uses the profile account type when present', () => {
		expect(
			accountTypeValue({
				id: 'u1',
				accountId: 'alice',
				name: 'Alice',
				role: 'user',
				profile: { accountType: 'team' } as never
			})
		).toBe('team');
	});

	test('falls back to admin for admin roles without a profile', () => {
		expect(
			accountTypeValue({
				id: 'u1',
				accountId: 'admin',
				name: 'Admin',
				role: 'admin',
				profile: null
			})
		).toBe('admin');
	});

	test('falls back to participant for non-admin roles without a profile', () => {
		expect(
			accountTypeValue({
				id: 'u1',
				accountId: 'guest',
				name: 'Guest',
				role: 'user',
				profile: null
			})
		).toBe('participant');
	});
});

describe('accountTypeLabel', () => {
	test.each([
		['admin', '運営'],
		['team', 'チーム'],
		['participant', '一般参加者'],
		['unknown', '一般参加者']
	])('maps %s to %s', (value, expected) => {
		expect(accountTypeLabel(value)).toBe(expected);
	});
});

describe('accountTypeBadgeColor', () => {
	test.each([
		['admin', 'red'],
		['team', 'blue'],
		['participant', 'zinc'],
		['unknown', 'zinc']
	])('maps %s to %s', (value, expected) => {
		expect(accountTypeBadgeColor(value)).toBe(expected);
	});
});

describe('accountTypeIcon', () => {
	test('maps admin to ShieldCheck', () => {
		expect(accountTypeIcon('admin')).toBe(ShieldCheck);
	});

	test('maps team to UsersRound', () => {
		expect(accountTypeIcon('team')).toBe(UsersRound);
	});

	test('maps other values to UserRound', () => {
		expect(accountTypeIcon('participant')).toBe(UserRound);
	});
});
