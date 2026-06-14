import { requireTeamLineupAccess } from '$lib/server/auth/access';
import {
	getTeam,
	getTieWithRubbers,
	listPlayersForTeam
} from '$lib/server/repositories/tokyoLeagueRepository';
import { getLineupItemsForTeam } from '$lib/server/services/lineupService';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { params } = event;
	requireTeamLineupAccess(params.teamId);

	const result = await getTieWithRubbers(params.tieId);
	if (!result) error(404, '対戦が見つかりません');

	const { tie } = result;
	const side = tie.teamAId === params.teamId ? 'A' : tie.teamBId === params.teamId ? 'B' : null;
	if (!side) error(404, 'このチームはこの対戦に参加していません');

	const opponentTeamId = side === 'A' ? tie.teamBId : tie.teamAId;

	const [team, players, { submission, items }, opponentTeam] = await Promise.all([
		getTeam(params.teamId),
		listPlayersForTeam(params.teamId),
		getLineupItemsForTeam(params.tieId, params.teamId),
		opponentTeamId ? getTeam(opponentTeamId) : Promise.resolve(null)
	]);
	if (!team) error(404, 'チームが見つかりません');

	return {
		tie,
		team,
		opponentTeam: opponentTeam ?? null,
		side,
		players,
		submission,
		items
	};
};
