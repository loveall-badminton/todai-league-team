import { requireAdmin } from '$lib/server/auth/access';
import { getRequestDb } from '$lib/server/db/request';
import {
	getLeagueSettings,
	listScoringRules
} from '$lib/server/repositories/tokyoLeagueRepository';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const { platform } = event;
	const db = getRequestDb(platform);
	const [settings, scoringRules] = await Promise.all([getLeagueSettings(db), listScoringRules(db)]);

	return { settings, scoringRules };
};
