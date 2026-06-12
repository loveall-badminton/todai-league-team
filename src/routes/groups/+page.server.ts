import type { PageServerLoad } from './$types';
import { getRequestDb } from '$lib/server/db/request';
import { listGroupTies, listTeamsByGroup } from '$lib/server/repositories/tokyoLeagueRepository';
import { ensureDefaultSettings } from '$lib/server/services/tokyoLeagueSetupService';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getRequestDb(platform);
	await ensureDefaultSettings(db);
	const [teamsA, teamsB, tiesA, tiesB] = await Promise.all([
		listTeamsByGroup(db, 'A'),
		listTeamsByGroup(db, 'B'),
		listGroupTies(db, 'A'),
		listGroupTies(db, 'B')
	]);
	return { teamsA, teamsB, tiesA, tiesB };
};
