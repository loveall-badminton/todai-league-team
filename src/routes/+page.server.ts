import type { PageServerLoad } from './$types';
import { getRequestDb } from '$lib/server/db/request';
import { getDashboard } from '$lib/server/repositories/tokyoLeagueRepository';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getRequestDb(platform);
	return getDashboard(db);
};
