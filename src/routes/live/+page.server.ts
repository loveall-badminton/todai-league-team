import type { PageServerLoad } from './$types';
import { getRequestDb } from '$lib/server/db/request';
import { getDashboard } from '$lib/server/repositories/tokyoLeagueRepository';
import { getPublicRubbersForTie } from '$lib/server/services/liveBoardService';
import { calculateGroupStandings } from '$lib/server/services/standingService';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getRequestDb(platform);
	const dashboard = await getDashboard(db);
	const [standingA, standingB, publicRubbers] = await Promise.all([
		calculateGroupStandings(db, 'A'),
		calculateGroupStandings(db, 'B'),
		Promise.all(
			dashboard.ties.map((tie) => getPublicRubbersForTie(db, tie.id, !!tie.lineupsRevealedAt))
		)
	]);
	return {
		...dashboard,
		standingA,
		standingB,
		finalsBoard: dashboard.finals,
		publicRubbersByTieId: Object.fromEntries(
			dashboard.ties.map((tie, index) => [tie.id, publicRubbers[index]])
		)
	};
};
