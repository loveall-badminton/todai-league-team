import { requireAdmin } from '$lib/server/auth/access';
import {
	getOfficiatingAssignment,
	getTeam,
	getTieWithRubbers,
	listPlayersByIds,
	listTeams
} from '$lib/server/repositories/tokyoLeagueRepository';
import { getLineupsForTie } from '$lib/server/services/lineupService';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAdmin();
	const { params } = event;
	const [tieResult, teams, officiating] = await Promise.all([
		getTieWithRubbers(params.tieId),
		listTeams(),
		getOfficiatingAssignment(params.tieId)
	]);
	if (!tieResult) error(404, 'Tie not found');
	const lineups = await getLineupsForTie(params.tieId);
	const playerIds = [
		...new Set(
			lineups
				.flatMap((l) => l.items.flatMap((i) => [i.player1Id, i.player2Id]))
				.filter((id): id is string => !!id)
		)
	];

	const [players, teamA, teamB] = await Promise.all([
		listPlayersByIds(playerIds),
		tieResult.tie.teamAId ? getTeam(tieResult.tie.teamAId) : null,
		tieResult.tie.teamBId ? getTeam(tieResult.tie.teamBId) : null
	]);
	return {
		...tieResult,
		tie: {
			...tieResult.tie,
			officiatingTeamId: officiating?.assignedTeamId ?? null,
			officiatingTeamIds: officiating?.assignedTeamIds ?? [],
			officiatingNote: officiating?.note ?? null
		},
		teams,
		lineups,
		players,
		teamA: teamA ?? null,
		teamB: teamB ?? null
	};
};
