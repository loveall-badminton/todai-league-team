import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/auth/access';
import { getRequestDb } from '$lib/server/db/request';
import { getTieWithRubbers, listTeams } from '$lib/server/repositories/tokyoLeagueRepository';
import { getLineupsForTie } from '$lib/server/services/lineupService';
import { getPublicRubbersForTie } from '$lib/server/services/liveBoardService';
import { teamPlayers, teams as teamsTable } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const { params, platform } = event;
	const db = getRequestDb(platform);
	const [tie, teams] = await Promise.all([getTieWithRubbers(db, params.tieId), listTeams(db)]);
	if (!tie) error(404, 'Tie not found');
	const lineups = await getLineupsForTie(db, params.tieId);
	const playerIds = [
		...new Set(
			lineups
				.flatMap((l) => l.items.flatMap((i) => [i.player1Id, i.player2Id]))
				.filter((id): id is string => !!id)
		)
	];
	const revealed =
		tie.tie.status === 'playing' || tie.tie.status === 'finished' || tie.tie.status === 'confirmed';
	const [players, teamA, teamB, liveRubbers] = await Promise.all([
		playerIds.length > 0
			? db.select().from(teamPlayers).where(inArray(teamPlayers.id, playerIds))
			: Promise.resolve([]),
		tie.tie.teamAId
			? db.query.teams.findFirst({ where: eq(teamsTable.id, tie.tie.teamAId) })
			: null,
		tie.tie.teamBId
			? db.query.teams.findFirst({ where: eq(teamsTable.id, tie.tie.teamBId) })
			: null,
		getPublicRubbersForTie(db, params.tieId, revealed)
	]);
	return {
		...tie,
		teams,
		lineups,
		players,
		teamA: teamA ?? null,
		teamB: teamB ?? null,
		liveRubbers
	};
};
