import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireRefereeMatchAccess } from '$lib/server/auth/access';
import { getRequestEvent } from '$app/server';
import { getMatchWithPlayers, getMatchState } from '$lib/server/repositories/matchRepository';
import { getScoreEvents } from '$lib/server/repositories/scoreEventRepository';

export const load: PageServerLoad = async () => {
	const { params } = getRequestEvent();
	const matchId = params.matchId!;
	await requireRefereeMatchAccess(matchId);

	const match = await getMatchWithPlayers(matchId);
	if (!match) error(404, 'Match not found');

	return {
		...match,
		state: await getMatchState(matchId),
		events: await getScoreEvents(matchId)
	};
};
