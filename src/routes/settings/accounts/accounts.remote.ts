import { command, form, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { invalidateAuthProfile, requireAdmin } from '$lib/server/auth/access';
import {
	assertTeamExists,
	createManagedAccount,
	roleForAccountType,
	upsertAuthProfile
} from '$lib/server/auth/accountManagement';
import { normalizeAccountId } from '$lib/server/auth/accountIds';
import { authUserProfiles } from '$lib/server/db/schema';
import { getRequestDb } from '$lib/server/db/request';

const accountTypeSchema = v.picklist(['participant', 'team', 'admin'] as const);

function apiErrorMessage(err: unknown, fallback: string): string {
	if (err instanceof APIError) return err.message || fallback;
	return err instanceof Error ? err.message : fallback;
}

export const createAccount = form(
	v.object({
		accountType: accountTypeSchema,
		accountId: v.pipe(v.string(), v.trim()),
		name: v.pipe(v.string(), v.trim(), v.minLength(1, '表示名は必須です')),
		password: v.pipe(v.string(), v.minLength(1, 'パスワードは必須です')),
		teamId: v.optional(v.string())
	}),
	async ({ accountType, accountId, name, password, teamId }) => {
		const event = getRequestEvent();
		requireAdmin(event);
		const resolvedTeamId = accountType === 'team' ? (teamId ?? null) : null;
		const db = getRequestDb(event.platform);
		try {
			await createManagedAccount({
				db,
				auth: event.locals.auth,
				headers: event.request.headers,
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
		const event = getRequestEvent();
		requireAdmin(event);
		const db = getRequestDb(event.platform);
		const resolvedTeamId = accountType === 'team' ? (teamId ?? null) : null;
		try {
			await assertTeamExists(db, resolvedTeamId);
			await event.locals.auth.api.adminUpdateUser({
				headers: event.request.headers,
				body: { userId, data: { name } }
			});
			await event.locals.auth.api.setRole({
				headers: event.request.headers,
				body: { userId, role: roleForAccountType(accountType) }
			});
			await upsertAuthProfile(db, {
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
		const event = getRequestEvent();
		requireAdmin(event);
		try {
			await event.locals.auth.api.setUserPassword({
				headers: event.request.headers,
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
		const event = getRequestEvent();
		requireAdmin(event);
		if (event.locals.user?.id === userId) error(400, '自分自身のアカウントは削除できません。');
		const db = getRequestDb(event.platform);
		try {
			await event.locals.auth.api.removeUser({
				headers: event.request.headers,
				body: { userId }
			});
			await db.delete(authUserProfiles).where(eq(authUserProfiles.userId, userId));
			invalidateAuthProfile(userId);
		} catch (err) {
			error(400, apiErrorMessage(err, 'アカウント削除に失敗しました。'));
		}
	}
);
