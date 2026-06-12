import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireRefereeMatchAccess } from '$lib/server/auth/access';
import { getRequestDb } from '$lib/server/db/request';
import { getMatchWithPlayers } from '$lib/server/repositories/matchRepository';
import { getMatchState } from '$lib/server/repositories/matchRepository';
import { getScoreEvents } from '$lib/server/repositories/scoreEventRepository';

export const load: PageServerLoad = async (event) => {
	const { params, platform } = event;
	const db = getRequestDb(platform);
	await requireRefereeMatchAccess(event, db, params.matchId);

	const match = await getMatchWithPlayers(db, params.matchId);
	if (!match) error(404, 'Match not found');

	return {
		...match,
		state: await getMatchState(db, params.matchId),
		events: await getScoreEvents(db, params.matchId)
	};
};
