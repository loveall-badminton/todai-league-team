import { requireAdmin } from '$lib/server/auth/access';
import { getRequestDb } from '$lib/server/db/request';
import { listTies } from '$lib/server/repositories/tokyoLeagueRepository';
import type { PageServerLoad } from './$types';

const finalPhases = ['semifinal', 'fifth_place', 'third_place', 'final'];

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const { platform } = event;
	const db = getRequestDb(platform);
	const ties = (await listTies(db)).filter((tie) => finalPhases.includes(tie.phase));
	return { ties };
};
