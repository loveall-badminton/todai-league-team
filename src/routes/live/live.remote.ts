import { query } from '$app/server';
import { calculateGroupStandings } from '$lib/server/services/standingService';
import {
	getActiveTieBoard,
	getFinalsTieBoard
} from '$lib/server/services/liveBoardService';
import { listGroupTies, listTeams } from '$lib/server/repositories/tokyoLeagueRepository';

export const getActiveTies = query(async () => {
	return getActiveTieBoard();
});

export const getGroupStandings = query(async () => {
	const [standingA, standingB, groupATies, groupBTies, teams] = await Promise.all([
		calculateGroupStandings('A'),
		calculateGroupStandings('B'),
		listGroupTies('A'),
		listGroupTies('B'),
		listTeams()
	]);
	return { standingA, standingB, groupA: groupATies, groupB: groupBTies, teams };
});

export const getFinalsBoard = query(async () => {
	return getFinalsTieBoard();
});
