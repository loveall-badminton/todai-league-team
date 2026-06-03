import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getRequestDb } from '$lib/server/db/request';
import {
	getTournament,
	listMatchesForTournament
} from '$lib/server/repositories/tournamentRepository';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = getRequestDb(platform);
	const tournament = await getTournament(db, params.tournamentId);
	if (!tournament) error(404, 'Tournament not found');

	return {
		tournament,
		matches: await listMatchesForTournament(db, params.tournamentId)
	};
};
