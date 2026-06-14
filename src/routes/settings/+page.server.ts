import { requireAdmin } from '$lib/server/auth/access';
import {
	getLeagueSettings,
	listScoringRules
} from '$lib/server/repositories/tokyoLeagueRepository';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	requireAdmin();
	const [settings, scoringRules] = await Promise.all([getLeagueSettings(), listScoringRules()]);

	return { settings, scoringRules };
};
