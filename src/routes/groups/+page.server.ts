import { requireAdmin } from '$lib/server/auth/access';
import { listGroupTies, listTeamsByGroup } from '$lib/server/repositories/tokyoLeagueRepository';
import { ensureDefaultSettings } from '$lib/server/services/tokyoLeagueSetupService';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	requireAdmin();
	await ensureDefaultSettings();
	const [teamsA, teamsB, tiesA, tiesB] = await Promise.all([
		listTeamsByGroup('A'),
		listTeamsByGroup('B'),
		listGroupTies('A'),
		listGroupTies('B')
	]);
	return { teamsA, teamsB, tiesA, tiesB };
};
