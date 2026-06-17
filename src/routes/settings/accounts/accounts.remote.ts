import { command, form, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { invalidateAuthProfile, requireAdmin } from '$lib/server/auth/access';
import {
	assertTeamExists,
	createManagedAccount,
	deleteAuthProfile,
	roleForAccountType,
	upsertAuthProfile
} from '$lib/server/auth/accountManagement';
import { normalizeAccountId } from '$lib/server/auth/accountIds';
import { apiErrorMessage } from '$lib/server/errors';

const accountTypeSchema = v.picklist(['participant', 'team', 'admin'] as const);

export const createAccount = form(
	v.object({
		accountType: accountTypeSchema,
		accountId: v.pipe(v.string(), v.trim()),
		name: v.pipe(v.string(), v.trim(), v.minLength(1, '表示名は必須です')),
		password: v.pipe(v.string(), v.minLength(1, 'パスワードは必須です')),
		teamId: v.optional(v.string())
	}),
	async ({ accountType, accountId, name, password, teamId }) => {
		requireAdmin();
		const resolvedTeamId = accountType === 'team' ? (teamId ?? null) : null;
		try {
			await createManagedAccount({
				accountId: normalizeAccountId(accountId),
				name,
				password,
				accountType,
				teamId: resolvedTeamId,
				now: new Date().toISOString()
			});
			return { message: 'アカウントを発行しました。' };
		} catch (err) {
			error(400, apiErrorMessage(err, 'アカウント発行に失敗しました。'));
		}
	}
);

export const updateAccount = form(
	v.object({
		userId: v.pipe(v.string(), v.trim(), v.minLength(1)),
		name: v.pipe(v.string(), v.trim(), v.minLength(1, '表示名は必須です')),
		accountType: accountTypeSchema,
		teamId: v.optional(v.string())
	}),
	async ({ userId, name, accountType, teamId }) => {
		requireAdmin();
		const { locals, request } = getRequestEvent();
		const resolvedTeamId = accountType === 'team' ? (teamId ?? null) : null;
		try {
			await assertTeamExists(resolvedTeamId);
			await locals.auth.api.adminUpdateUser({
				headers: request.headers,
				body: { userId, data: { name } }
			});
			await locals.auth.api.setRole({
				headers: request.headers,
				body: { userId, role: roleForAccountType(accountType) }
			});
			await upsertAuthProfile({
				userId,
				accountType,
				teamId: resolvedTeamId,
				displayName: name,
				now: new Date().toISOString()
			});
			invalidateAuthProfile(userId);
			return { message: 'アカウントを更新しました。' };
		} catch (err) {
			error(400, apiErrorMessage(err, 'アカウント更新に失敗しました。'));
		}
	}
);

export const resetPassword = form(
	v.object({
		userId: v.pipe(v.string(), v.trim(), v.minLength(1)),
		password: v.pipe(v.string(), v.minLength(1, 'パスワードは必須です'))
	}),
	async ({ userId, password }) => {
		requireAdmin();
		const { locals, request } = getRequestEvent();
		try {
			await locals.auth.api.setUserPassword({
				headers: request.headers,
				body: { userId, newPassword: password }
			});
			return { message: 'パスワードを更新しました。' };
		} catch (err) {
			error(400, apiErrorMessage(err, 'パスワード更新に失敗しました。'));
		}
	}
);

export const deleteAccount = command(
	v.object({ userId: v.pipe(v.string(), v.trim(), v.minLength(1)) }),
	async ({ userId }) => {
		requireAdmin();
		const { locals, request } = getRequestEvent();
		if (locals.user?.id === userId) error(400, '自分自身のアカウントは削除できません。');
		try {
			await locals.auth.api.removeUser({
				headers: request.headers,
				body: { userId }
			});
			await deleteAuthProfile(userId);
			invalidateAuthProfile(userId);
		} catch (err) {
			error(400, apiErrorMessage(err, 'アカウント削除に失敗しました。'));
		}
	}
);
