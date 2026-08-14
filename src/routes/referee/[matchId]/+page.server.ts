import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireRefereeMatchAccess } from '$lib/server/auth/access';
import { getRequestEvent } from '$app/server';
import { getMatchWithPlayers, getMatchState } from '$lib/server/repositories/matchRepository';
import { getScoreEvents } from '$lib/server/repositories/scoreEventRepository';

export const load: PageServerLoad = async () => {
	const event = getRequestEvent();
	const params = event.params;
	const matchId = params.matchId!;
	await requireRefereeMatchAccess(matchId);

	const [match, state, events] = await Promise.all([
		getMatchWithPlayers(matchId),
		getMatchState(matchId),
		getScoreEvents(matchId)
	]);
	if (!match) error(404, 'Match not found');

	return {
		...match,
		state,
		events
	};
};
