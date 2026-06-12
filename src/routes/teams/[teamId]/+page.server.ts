import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/auth/access';
import { getRequestDb } from '$lib/server/db/request';
import { getTeamWithPlayers } from '$lib/server/repositories/tokyoLeagueRepository';

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const { params, platform } = event;
	const db = getRequestDb(platform);
	const team = await getTeamWithPlayers(db, params.teamId);
	if (!team) error(404, 'Team not found');
	return team;
};
