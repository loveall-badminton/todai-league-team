import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { bootstrapAdminAccount } from '$lib/server/auth/accountManagement';
import { normalizeAccountId } from '$lib/server/auth/accountIds';
import { getRequestDb } from '$lib/server/db/request';
import type { Actions, PageServerLoad } from './$types';

type CountRow = {
	value: number;
};

const userCount = async (platform: App.Platform | undefined) => {
	if (!platform?.env.DB) return 0;
	const result = await platform.env.DB.prepare(
		'select count(*) as value from "user"'
	).first<CountRow>();
	return Number(result?.value ?? 0);
};

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (locals.user) redirect(303, '/');
	return { hasUsers: (await userCount(platform)) > 0 };
};

export const actions: Actions = {
	createAdmin: async ({ request, locals, platform }) => {
		if ((await userCount(platform)) > 0) {
			return fail(403, { message: '初回管理者はすでに作成済みです。', accountId: '', name: '' });
		}

		const formData = await request.formData();
		let accountId = '';
		const password = String(formData.get('password') ?? '');
		const name = String(formData.get('name') ?? '').trim();

		try {
			accountId = normalizeAccountId(formData.get('accountId'));
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
				db: getRequestDb(platform),
				auth: locals.auth,
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
};
