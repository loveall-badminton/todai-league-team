import {
	getOfficiatingAssignment,
	getTeam,
	getTieWithRubbers,
	listPlayersByIds,
	listTeams
} from '$lib/server/repositories/tokyoLeagueRepository';
import { getLineupsForTie } from '$lib/server/services/lineupService';
import { error } from '@sveltejs/kit';

export async function getTieHeaderData(tieId: string) {
	const [tieResult, teams, officiating] = await Promise.all([
		getTieWithRubbers(tieId),
		listTeams(),
		getOfficiatingAssignment(tieId)
	]);
	if (!tieResult) error(404, 'Tie not found');

	const [teamA, teamB] = await Promise.all([
		tieResult.tie.teamAId ? getTeam(tieResult.tie.teamAId) : null,
		tieResult.tie.teamBId ? getTeam(tieResult.tie.teamBId) : null
	]);

	return {
		tie: {
			...tieResult.tie,
			officiatingTeamId: officiating?.assignedTeamId ?? null,
			officiatingTeamIds: officiating?.assignedTeamIds ?? [],
			officiatingNote: officiating?.note ?? null
		},
		rubbers: tieResult.rubbers,
		teams,
		teamA: teamA ?? null,
		teamB: teamB ?? null
	};
}

export async function getTieLineupsData(tieId: string) {
	const lineups = await getLineupsForTie(tieId);
	const playerIds = [
		...new Set(
			lineups
				.flatMap((lineup) => lineup.items.flatMap((item) => [item.player1Id, item.player2Id]))
				.filter((id): id is string => !!id)
		)
	];

	const players = await listPlayersByIds(playerIds);

	return {
		tie: {
			id: tieId
		},
		lineups,
		players
	};
}
