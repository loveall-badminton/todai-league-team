import { redirect } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import type { PageServerLoad } from './$types';
import { safeRedirectTo } from '$lib/server/auth/redirectUtils';
import { userCount } from '$lib/server/auth/userCount';

export const load: PageServerLoad = async () => {
	const { locals, url } = getRequestEvent();
	if (locals.user) redirect(303, safeRedirectTo(url.searchParams.get('redirectTo')));
	return {
		redirectTo: safeRedirectTo(url.searchParams.get('redirectTo')),
		showBootstrap: (await userCount()) === 0
	};
};
