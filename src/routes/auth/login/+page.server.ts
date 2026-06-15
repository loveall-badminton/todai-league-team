import { redirect } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import type { PageServerLoad } from './$types';
import { safeRedirectTo } from '$lib/server/auth/redirectUtils';
import { userCount } from '$lib/server/auth/userCount';
import { parseSearchParams } from '$lib/utils/searchParams';
import * as v from 'valibot';

const loginSearchParamsSchema = v.object({
	redirectTo: v.optional(v.string())
});

export const load: PageServerLoad = async () => {
	const { locals, url } = getRequestEvent();
	const searchParams = parseSearchParams(url.searchParams, loginSearchParamsSchema, {});
	const redirectTo = safeRedirectTo(searchParams.redirectTo ?? null);
	if (locals.user) redirect(303, redirectTo);

	return {
		redirectTo,
		showBootstrap: (await userCount()) === 0
	};
};
