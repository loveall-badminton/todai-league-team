import { redirect } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import type { PageServerLoad } from './$types';
import { userCount } from '$lib/server/auth/userCount';

export const load: PageServerLoad = async () => {
	const { locals } = getRequestEvent();
	if (locals.user) redirect(303, '/');
	return { hasUsers: (await userCount()) > 0 };
};
