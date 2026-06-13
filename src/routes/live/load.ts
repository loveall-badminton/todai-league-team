import { and, asc, eq, inArray, or } from 'drizzle-orm';
import { getRequestDb } from '$lib/server/db/request';
import { getDashboard } from '$lib/server/repositories/tokyoLeagueRepository';
import { getPublicRubbersForTie } from '$lib/server/services/liveBoardService';
import { calculateGroupStandings } from '$lib/server/services/standingService';
import { officiatingAssignments, teams, ties } from '$lib/server/db/schema';
import type { AuthProfile } from '$lib/server/auth/access';

export async function loadLiveOverviewPageData(platform: App.Platform | undefined) {
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
}

export async function loadLiveTasksPageData(
	platform: App.Platform | undefined,
	authProfile: AuthProfile | null | undefined
) {
	const db = getRequestDb(platform);
	if (authProfile?.accountType !== 'team' || !authProfile.teamId) {
		return {
			myTies: [],
			myOfficiatingTies: [],
			publicRubbersByTieId: {}
		};
	}

	const teamId = authProfile.teamId;
	const [teamRows, myTieRows, officiatingRows] = await Promise.all([
		db.select().from(teams),
		db
			.select()
			.from(ties)
			.where(or(eq(ties.teamAId, teamId), eq(ties.teamBId, teamId)))
			.orderBy(asc(ties.displayOrder), asc(ties.tieCode)),
		db
			.select({ tieId: officiatingAssignments.tieId })
			.from(officiatingAssignments)
			.where(
				and(
					eq(officiatingAssignments.assignedTeamId, teamId),
					eq(officiatingAssignments.role, 'umpire_team')
				)
			)
	]);

	const officiatingTieIdSet = new Set(officiatingRows.map((row) => row.tieId));
	const officiatingTieRows = officiatingTieIdSet.size
		? await db
				.select()
				.from(ties)
				.where(inArray(ties.id, [...officiatingTieIdSet]))
				.orderBy(asc(ties.displayOrder), asc(ties.tieCode))
		: [];

	const toSummary = (tie: typeof ties.$inferSelect) => ({
		id: tie.id,
		tieCode: tie.tieCode,
		status: tie.status,
		teamAName: teamRows.find((team) => team.id === tie.teamAId)?.name ?? null,
		teamBName: teamRows.find((team) => team.id === tie.teamBId)?.name ?? null
	});

	const myTies = myTieRows.filter((tie) => tie.status !== 'cancelled').map(toSummary);
	const myOfficiatingTies = officiatingTieRows
		.filter((tie) => tie.status !== 'cancelled')
		.map(toSummary);
	const publicTieIds = [...new Set([...myTies, ...myOfficiatingTies].map((tie) => tie.id))];
	const publicRubbers = await Promise.all(
		publicTieIds.map((tieId) => getPublicRubbersForTie(db, tieId, false))
	);

	return {
		myTies,
		myOfficiatingTies,
		publicRubbersByTieId: Object.fromEntries(
			publicTieIds.map((tieId, index) => [tieId, publicRubbers[index]])
		)
	};
}
