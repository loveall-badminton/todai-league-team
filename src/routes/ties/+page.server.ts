import type { PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/auth/access';
import { getRequestDb } from '$lib/server/db/request';
import {
	listScoringRules,
	listTeams,
	listTies
} from '$lib/server/repositories/tokyoLeagueRepository';
import { ensureDefaultSettings } from '$lib/server/services/tokyoLeagueSetupService';

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const { platform } = event;
	const db = getRequestDb(platform);
	await ensureDefaultSettings(db);
	const [ties, teams, scoringRules] = await Promise.all([
		listTies(db),
		listTeams(db),
		listScoringRules(db)
	]);
	return { ties, teams, scoringRules };
};
