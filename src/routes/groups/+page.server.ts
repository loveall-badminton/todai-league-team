import { adminPageLoad } from '$lib/server/loadHelpers';
import { listGroupTies, listTeamsByGroup } from '$lib/server/repositories/tokyoLeagueRepository';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	await adminPageLoad();
	const [teamsA, teamsB, tiesA, tiesB] = await Promise.all([
		listTeamsByGroup('A'),
		listTeamsByGroup('B'),
		listGroupTies('A'),
		listGroupTies('B')
	]);
	return { teamsA, teamsB, tiesA, tiesB };
};
