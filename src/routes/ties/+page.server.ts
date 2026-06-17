import { listTies } from '$lib/server/repositories/tokyoLeagueRepository';
import { adminPageLoadWithDefaults } from '$lib/server/loadHelpers';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const { teams, scoringRules } = await adminPageLoadWithDefaults();
	const ties = await listTies();
	return { ties, teams, scoringRules };
};
