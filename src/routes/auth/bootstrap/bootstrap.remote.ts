import { form } from '$app/server';
import { normalizeAccountId } from '$lib/server/auth/accountIds';
import { bootstrapAdminAccount } from '$lib/server/auth/accountManagement';
import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth';
import { userCount } from '$lib/server/auth/userCount';
import { createAdminSchema } from './bootstrap.schema';

export const createAdmin = form(
	createAdminSchema,
	async ({ accountId: rawAccountId, password, name }) => {
		if ((await userCount()) > 0) {
			return fail(403, { message: '初回管理者はすでに作成済みです。', accountId: '', name: '' });
		}

		let accountId = rawAccountId;

		try {
			accountId = normalizeAccountId(rawAccountId);
		} catch (caught) {
			return fail(400, {
				message: caught instanceof Error ? caught.message : 'ID が不正です。',
				accountId,
				name
			});
		}

		if (!password || !name) {
			return fail(400, { message: 'ID、表示名、パスワードを入力してください。', accountId, name });
		}

		try {
			await bootstrapAdminAccount({
				accountId,
				password,
				name,
				now: new Date().toISOString()
			});
		} catch (caught) {
			if (caught instanceof APIError) {
				return fail(400, {
					message: caught.message || '初回管理者の作成に失敗しました。',
					accountId,
					name
				});
			}
			return fail(500, { message: '初回管理者の作成に失敗しました。', accountId, name });
		}

		redirect(303, '/auth/login');
	}
);
