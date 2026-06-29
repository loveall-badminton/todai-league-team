import { getBatchedPublicRubbers } from '$lib/server/services/liveBoardService';
import {
	listOfficiatingTieIds,
	listTeams,
	listTiesByIds,
	listTiesForTeam
} from '$lib/server/repositories/tokyoLeagueRepository';
import type { AuthProfile } from '$lib/server/auth/access';
import { getRequestDb } from '$lib/server/db/request';
import { ties } from '$lib/server/db/schema';
import { and, eq, or } from 'drizzle-orm';

export async function loadPendingLineupBanner(teamId: string) {
	const db = getRequestDb();
	return db
		.select({ id: ties.id, tieCode: ties.tieCode, lineupDueAt: ties.lineupDueAt })
		.from(ties)
		.where(
			and(or(eq(ties.teamAId, teamId), eq(ties.teamBId, teamId)), eq(ties.status, 'lineup_pending'))
		);
}

export async function loadLiveTasksPageData(authProfile: AuthProfile | null | undefined) {
	if (authProfile?.accountType !== 'team' || !authProfile.teamId) {
		return { myTies: [], myOfficiatingTies: [], publicRubbersByTieId: {} };
	}

	const teamId = authProfile.teamId;
	const [teamRows, myTieRows, officiatingTieIds] = await Promise.all([
		listTeams(),
		listTiesForTeam(teamId),
		listOfficiatingTieIds(teamId)
	]);

	const officiatingTieRows = await listTiesByIds(officiatingTieIds);
	const teamNameById = new Map(teamRows.map((team) => [team.id, team.name]));

	const toSummary = (tie: (typeof myTieRows)[number]) => ({
		id: tie.id,
		tieCode: tie.tieCode,
		status: tie.status,
		teamAName: tie.teamAId ? (teamNameById.get(tie.teamAId) ?? null) : null,
		teamBName: tie.teamBId ? (teamNameById.get(tie.teamBId) ?? null) : null,
		scheduledStartAt: tie.scheduledStartAt,
		lineupDueAt: tie.lineupDueAt
	});

	const myTies = myTieRows.filter((tie) => tie.status !== 'cancelled').map(toSummary);
	const myOfficiatingTies = officiatingTieRows
		.filter((tie) => tie.status !== 'cancelled')
		.map(toSummary);
	const publicTieIds = [...new Set([...myTies, ...myOfficiatingTies].map((tie) => tie.id))];
	const publicRubbers = await getBatchedPublicRubbers(publicTieIds, { revealed: false });

	return {
		myTies,
		myOfficiatingTies,
		publicRubbersByTieId: Object.fromEntries(
			publicTieIds.map((tieId, index) => [tieId, publicRubbers[index]])
		)
	};
}
