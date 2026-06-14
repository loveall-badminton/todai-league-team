import { requireAdmin } from '$lib/server/auth/access';
import { getTeamWithPlayers } from '$lib/server/repositories/tokyoLeagueRepository';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAdmin();
	const { params } = event;
	const team = await getTeamWithPlayers(params.teamId);
	if (!team) error(404, 'Team not found');
	return team;
};
