import type { PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/auth/access';
import { getRequestDb } from '$lib/server/db/request';
import { listTeams } from '$lib/server/repositories/tokyoLeagueRepository';
import { ensureDefaultSettings } from '$lib/server/services/tokyoLeagueSetupService';

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const { platform } = event;
	const db = getRequestDb(platform);
	await ensureDefaultSettings(db);
	return {
		teams: await listTeams(db)
	};
};
