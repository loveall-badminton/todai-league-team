import { form, getRequestEvent } from '$app/server';
import { normalizeAccountId } from '$lib/server/auth/accountIds';
import { safeRedirectTo } from '$lib/server/auth/redirectUtils';
import { redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth';
import * as v from 'valibot';

export const signIn = form(
	v.object({
		accountId: v.string(),
		password: v.string(),
		redirectTo: v.optional(v.string())
	}),
	async ({ accountId, password, redirectTo: rawRedirectTo }) => {
		const { locals } = getRequestEvent();

		const redirectTo = safeRedirectTo(rawRedirectTo ?? null);

		try {
			accountId = normalizeAccountId(accountId);
		} catch (caught) {
			return {
				message: caught instanceof Error ? caught.message : 'ID が不正です。',
				accountId,
				redirectTo
			};
		}

		if (!password) {
			return { message: 'ID とパスワードを入力してください。', accountId, redirectTo };
		}

		try {
			await locals.auth.api.signInUsername({
				body: { username: accountId, password }
			});
		} catch (caught) {
			if (caught instanceof APIError) {
				return { message: 'ID またはパスワードが違います。', accountId, redirectTo };
			}
			return { message: 'ログインに失敗しました。', accountId, redirectTo };
		}

		redirect(303, redirectTo);
	}
);
