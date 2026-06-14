import { requireAdmin } from '$lib/server/auth/access';
import { listTeams } from '$lib/server/repositories/tokyoLeagueRepository';
import { ensureDefaultSettings } from '$lib/server/services/tokyoLeagueSetupService';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	requireAdmin();
	await ensureDefaultSettings();
	return {
		teams: await listTeams()
	};
};
