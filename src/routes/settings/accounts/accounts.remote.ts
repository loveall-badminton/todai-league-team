import { command, form, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { invalidateAuthProfile, requireAdmin } from '$lib/server/auth/access';
import { createAccountSchema, resetPasswordSchema, updateAccountSchema } from './accounts.schema';
import {
	assertTeamExists,
	createManagedAccount,
	deleteAuthProfile,
	roleForAccountType,
	upsertAuthProfile
} from '$lib/server/auth/accountManagement';
import { normalizeAccountId } from '$lib/server/auth/accountIds';
import { actionErrorMessage } from '$lib/server/errors';

export const createAccount = form(
	createAccountSchema,
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
			error(400, actionErrorMessage(err, 'アカウント発行に失敗しました。'));
		}
	}
);

export const updateAccount = form(
	updateAccountSchema,
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
			error(400, actionErrorMessage(err, 'アカウント更新に失敗しました。'));
		}
	}
);

export const resetPassword = form(resetPasswordSchema, async ({ userId, password }) => {
	requireAdmin();
	const { locals, request } = getRequestEvent();
	try {
		await locals.auth.api.setUserPassword({
			headers: request.headers,
			body: { userId, newPassword: password }
		});
		return { message: 'パスワードを更新しました。' };
	} catch (err) {
		error(400, actionErrorMessage(err, 'パスワード更新に失敗しました。'));
	}
});

export const deleteAccount = command(
	v.object({ userId: v.pipe(v.string(), v.trim(), v.nonEmpty()) }),
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
			error(400, actionErrorMessage(err, 'アカウント削除に失敗しました。'));
		}
	}
);
