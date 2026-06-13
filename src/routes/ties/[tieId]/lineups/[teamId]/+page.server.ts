import { error } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { requireTeamLineupAccess } from '$lib/server/auth/access';
import { getRequestDb } from '$lib/server/db/request';
import { lineupItems, lineupSubmissions, teamPlayers, teams } from '$lib/server/db/schema';
import { getTieWithRubbers } from '$lib/server/repositories/tokyoLeagueRepository';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { params, platform } = event;
	requireTeamLineupAccess(event, params.teamId);

	const db = getRequestDb(platform);
	const result = await getTieWithRubbers(db, params.tieId);
	if (!result) error(404, '対戦が見つかりません');

	const { tie } = result;
	const side = tie.teamAId === params.teamId ? 'A' : tie.teamBId === params.teamId ? 'B' : null;
	if (!side) error(404, 'このチームはこの対戦に参加していません');

	const team = await db.query.teams.findFirst({ where: eq(teams.id, params.teamId) });
	if (!team) error(404, 'チームが見つかりません');

	const opponentTeamId = side === 'A' ? tie.teamBId : tie.teamAId;

	const [players, submission, opponentTeam] = await Promise.all([
		db
			.select()
			.from(teamPlayers)
			.where(eq(teamPlayers.teamId, params.teamId))
			.orderBy(asc(teamPlayers.displayOrder), asc(teamPlayers.name)),
		db.query.lineupSubmissions.findFirst({
			where: and(
				eq(lineupSubmissions.tieId, params.tieId),
				eq(lineupSubmissions.teamId, params.teamId)
			)
		}),
		opponentTeamId
			? db.query.teams.findFirst({ where: eq(teams.id, opponentTeamId) })
			: Promise.resolve(null)
	]);

	const items = submission
		? await db
				.select()
				.from(lineupItems)
				.where(eq(lineupItems.submissionId, submission.id))
				.orderBy(asc(lineupItems.rubberCode))
		: [];

	return {
		tie,
		team,
		opponentTeam: opponentTeam ?? null,
		side,
		players,
		submission: submission ?? null,
		items
	};
};
