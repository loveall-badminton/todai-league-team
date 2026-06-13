import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { normalizeAccountId } from '$lib/server/auth/accountIds';
import type { Actions, PageServerLoad } from './$types';

const safeRedirectTo = (value: FormDataEntryValue | string | null): string => {
	const redirectTo = String(value ?? '/');
	return redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/';
};

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	if (locals.user) redirect(303, safeRedirectTo(url.searchParams.get('redirectTo')));
	const userCount = platform?.env.DB
		? Number(
				(await platform.env.DB.prepare('select count(*) as n from "user"').first<{ n: number }>())
					?.n ?? 0
			)
		: 1;
	return {
		redirectTo: safeRedirectTo(url.searchParams.get('redirectTo')),
		showBootstrap: userCount === 0
	};
};

export const actions: Actions = {
	signIn: async ({ request, locals }) => {
		const formData = await request.formData();
		let accountId = '';
		const password = String(formData.get('password') ?? '');
		const redirectTo = safeRedirectTo(formData.get('redirectTo'));

		try {
			accountId = normalizeAccountId(formData.get('accountId'));
		} catch (caught) {
			return fail(400, {
				message: caught instanceof Error ? caught.message : 'ID が不正です。',
				accountId,
				redirectTo
			});
		}

		if (!password) {
			return fail(400, { message: 'ID とパスワードを入力してください。', accountId, redirectTo });
		}

		try {
			await locals.auth.api.signInUsername({
				body: { username: accountId, password }
			});
		} catch (caught) {
			if (caught instanceof APIError) {
				return fail(400, { message: 'ID またはパスワードが違います。', accountId, redirectTo });
			}
			return fail(500, { message: 'ログインに失敗しました。', accountId, redirectTo });
		}

		redirect(303, redirectTo);
	}
};
