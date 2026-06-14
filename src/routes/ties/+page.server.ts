import { requireAdmin } from '$lib/server/auth/access';
import {
	listScoringRules,
	listTeams,
	listTies
} from '$lib/server/repositories/tokyoLeagueRepository';
import { ensureDefaultSettings } from '$lib/server/services/tokyoLeagueSetupService';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	requireAdmin();
	await ensureDefaultSettings();
	const [ties, teams, scoringRules] = await Promise.all([
		listTies(),
		listTeams(),
		listScoringRules()
	]);
	return { ties, teams, scoringRules };
};
