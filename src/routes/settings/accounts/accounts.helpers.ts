import { ShieldCheck, UserRound, UsersRound } from '@lucide/svelte';
import type { Component } from 'svelte';
import type { ManagedAccount } from '$lib/server/auth/accountManagement';

export function accountTypeValue(account: ManagedAccount): string {
	if (account.profile?.accountType) return account.profile.accountType;
	return account.role === 'admin' ? 'admin' : 'participant';
}

export function accountTypeLabel(value: string): string {
	if (value === 'admin') return '運営';
	if (value === 'team') return 'チーム';
	return '一般参加者';
}

export function accountTypeBadgeColor(value: string): 'red' | 'blue' | 'zinc' {
	if (value === 'admin') return 'red';
	if (value === 'team') return 'blue';
	return 'zinc';
}

export function accountTypeIcon(value: string): Component {
	if (value === 'admin') return ShieldCheck;
	if (value === 'team') return UsersRound;
	return UserRound;
}
