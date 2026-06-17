import { requireAdmin } from '$lib/server/auth/access';
import { ensureDefaultSettings } from '$lib/server/services/tokyoLeagueSetupService';
import { listScoringRules, listTeams } from '$lib/server/repositories/tokyoLeagueRepository';

export async function adminPageLoad() {
	requireAdmin();
	await ensureDefaultSettings();
}

export async function adminPageLoadWithDefaults() {
	requireAdmin();
	const settings = await ensureDefaultSettings();
	const [teams, scoringRules] = await Promise.all([listTeams(), listScoringRules()]);
	return { teams, scoringRules, settings };
}
