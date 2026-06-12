import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isAdminUser } from '$lib/server/auth/access';
import { getRequestDb } from '$lib/server/db/request';
import { getDashboard } from '$lib/server/repositories/tokyoLeagueRepository';

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (!isAdminUser(locals.user)) redirect(303, '/live');
	const db = getRequestDb(platform);
	return getDashboard(db);
};
