import { and, asc, count, eq } from 'drizzle-orm';
import type { GroupCode, TiePhase } from '$lib/domain/tokyoLeague';
import type { AppDb } from '$lib/server/db/client';
import {
	appSettings,
	groupStandingOverrides,
	officiatingAssignments,
	rankingTiebreakers,
	rubbers,
	scoringRules,
	teamPlayers,
	teams,
	ties
} from '$lib/server/db/schema';
import {
	listUnassignedOfficiatingTies,
	nextOfficiatingAssignmentStatus
} from '$lib/server/services/officiatingService';
import { ensureDefaultSettings } from '$lib/server/services/tokyoLeagueSetupService';

export type Team = typeof teams.$inferSelect;
export type TeamPlayer = typeof teamPlayers.$inferSelect;
export type Tie = typeof ties.$inferSelect;
export type Rubber = typeof rubbers.$inferSelect;
export type ScoringRule = typeof scoringRules.$inferSelect;
export type LeagueSettings = typeof appSettings.$inferSelect;
export type OfficiatingAssignment = typeof officiatingAssignments.$inferSelect;
export type RankingTiebreaker = typeof rankingTiebreakers.$inferSelect;

export interface TeamSummary extends Team {
	playerCount: number;
}

export interface TieSummary extends Tie {
	teamAName: string | null;
	teamBName: string | null;
	officiatingTeamId: string | null;
	officiatingTeamName: string | null;
	officiatingNote: string | null;
	rubberCount: number;
}

export async function getLeagueSettings(db: AppDb) {
	return ensureDefaultSettings(db);
}

export async function listScoringRules(db: AppDb): Promise<ScoringRule[]> {
	await ensureDefaultSettings(db);
	return db.select().from(scoringRules).orderBy(asc(scoringRules.code));
}

export async function updateLeagueSettings(
	db: AppDb,
	input: {
		eventName: string;
		groupStageScoringRuleId: string | null;
		knockoutScoringRuleId: string | null;
		tiebreakerScoringRuleId: string | null;
		lineupRevealPolicy: 'on_tie_start' | 'manual';
		defaultLineupDueMinutesBefore: number;
		now: string;
	}
) {
	await ensureDefaultSettings(db, input.now);
	await db
		.update(appSettings)
		.set({
			eventName: input.eventName,
			groupStageScoringRuleId: input.groupStageScoringRuleId,
			knockoutScoringRuleId: input.knockoutScoringRuleId,
			tiebreakerScoringRuleId: input.tiebreakerScoringRuleId,
			lineupRevealPolicy: input.lineupRevealPolicy,
			defaultLineupDueMinutesBefore: input.defaultLineupDueMinutesBefore,
			updatedAt: input.now
		})
		.where(eq(appSettings.id, 'default'));
}

export async function updateScoringRule(
	db: AppDb,
	input: {
		id: string;
		name: string;
		maxGames: number;
		gamesToWin: number;
		pointsToWin: number;
		winBy: number;
		maxPoints: number;
		midGameIntervalPoint: number;
		now: string;
	}
) {
	await ensureDefaultSettings(db, input.now);
	await db
		.update(scoringRules)
		.set({
			name: input.name,
			maxGames: input.maxGames,
			gamesToWin: input.gamesToWin,
			pointsToWin: input.pointsToWin,
			winBy: input.winBy,
			maxPoints: input.maxPoints,
			midGameIntervalPoint: input.midGameIntervalPoint,
			updatedAt: input.now
		})
		.where(eq(scoringRules.id, input.id));
}

export async function listTeams(db: AppDb): Promise<TeamSummary[]> {
	const rows = await db.select().from(teams).orderBy(asc(teams.displayOrder), asc(teams.name));
	return Promise.all(
		rows.map(async (team) => {
			const [{ value }] = await db
				.select({ value: count() })
				.from(teamPlayers)
				.where(eq(teamPlayers.teamId, team.id));
			return { ...team, playerCount: value };
		})
	);
}

export async function listTeamsByGroup(db: AppDb, groupCode: GroupCode): Promise<TeamSummary[]> {
	const all = await listTeams(db);
	return all.filter((team) => team.groupCode === groupCode && team.status === 'active');
}

export async function getTeamWithPlayers(db: AppDb, teamId: string) {
	const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
	if (!team) return null;
	const players = await db
		.select()
		.from(teamPlayers)
		.where(eq(teamPlayers.teamId, teamId))
		.orderBy(asc(teamPlayers.displayOrder), asc(teamPlayers.name));
	return { team, players };
}

export async function createTeam(
	db: AppDb,
	input: {
		name: string;
		shortName?: string | null;
		groupCode?: GroupCode | null;
		displayOrder?: number;
		now: string;
	}
) {
	const id = crypto.randomUUID();
	await db.insert(teams).values({
		id,
		name: input.name,
		shortName: input.shortName ?? null,
		groupCode: input.groupCode ?? null,
		displayOrder: input.displayOrder ?? 0,
		createdAt: input.now,
		updatedAt: input.now
	});
	return id;
}

export async function updateTeam(
	db: AppDb,
	input: {
		id: string;
		name: string;
		shortName?: string | null;
		groupCode?: GroupCode | null;
		displayOrder?: number;
		status?: 'active' | 'withdrawn';
		now: string;
	}
) {
	await db
		.update(teams)
		.set({
			name: input.name,
			shortName: input.shortName ?? null,
			groupCode: input.groupCode ?? null,
			...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
			status: input.status ?? 'active',
			updatedAt: input.now
		})
		.where(eq(teams.id, input.id));
}

export async function createTeamPlayer(
	db: AppDb,
	input: {
		teamId: string;
		name: string;
		gender?: 'male' | 'female' | 'unknown';
		displayOrder?: number;
		now: string;
	}
) {
	const id = crypto.randomUUID();
	await db.insert(teamPlayers).values({
		id,
		teamId: input.teamId,
		name: input.name,
		gender: input.gender ?? 'unknown',
		displayOrder: input.displayOrder ?? 0,
		createdAt: input.now,
		updatedAt: input.now
	});
	return id;
}

export async function updateTeamPlayer(
	db: AppDb,
	input: {
		id: string;
		name: string;
		gender: 'male' | 'female' | 'unknown';
		displayOrder?: number;
		status: 'active' | 'inactive';
		now: string;
	}
) {
	await db
		.update(teamPlayers)
		.set({
			name: input.name,
			gender: input.gender,
			...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
			status: input.status,
			updatedAt: input.now
		})
		.where(eq(teamPlayers.id, input.id));
}

export async function reorderTeams(db: AppDb, orderedIds: string[], now: string) {
	for (let i = 0; i < orderedIds.length; i++) {
		await db
			.update(teams)
			.set({ displayOrder: i, updatedAt: now })
			.where(eq(teams.id, orderedIds[i]));
	}
}

export async function reorderTeamPlayers(db: AppDb, orderedIds: string[], now: string) {
	for (let i = 0; i < orderedIds.length; i++) {
		await db
			.update(teamPlayers)
			.set({ displayOrder: i, updatedAt: now })
			.where(eq(teamPlayers.id, orderedIds[i]));
	}
}

export async function deleteTeam(db: AppDb, teamId: string) {
	await db.delete(teams).where(eq(teams.id, teamId));
}

export async function deleteTeamPlayer(db: AppDb, playerId: string) {
	await db.delete(teamPlayers).where(eq(teamPlayers.id, playerId));
}

export async function deleteTie(db: AppDb, tieId: string) {
	await db.delete(ties).where(eq(ties.id, tieId));
}

export async function reorderTies(db: AppDb, orderedIds: string[], now: string) {
	for (let i = 0; i < orderedIds.length; i++) {
		await db
			.update(ties)
			.set({ displayOrder: i, updatedAt: now })
			.where(eq(ties.id, orderedIds[i]));
	}
}

export async function listTies(db: AppDb, phase?: TiePhase): Promise<TieSummary[]> {
	const tieRows = phase
		? await db
				.select()
				.from(ties)
				.where(eq(ties.phase, phase))
				.orderBy(asc(ties.displayOrder), asc(ties.tieCode))
		: await db.select().from(ties).orderBy(asc(ties.displayOrder), asc(ties.tieCode));
	const teamRows = await db.select().from(teams);

	return Promise.all(
		tieRows.map(async (tie) => {
			const [{ value: rubberCount }] = await db
				.select({ value: count() })
				.from(rubbers)
				.where(eq(rubbers.tieId, tie.id));
			const assignments = await db
				.select()
				.from(officiatingAssignments)
				.where(eq(officiatingAssignments.tieId, tie.id))
				.orderBy(asc(officiatingAssignments.createdAt));
			const assignment = assignments[0] ?? null;

			return {
				...tie,
				teamAName: teamRows.find((team) => team.id === tie.teamAId)?.name ?? null,
				teamBName: teamRows.find((team) => team.id === tie.teamBId)?.name ?? null,
				officiatingTeamId: assignment?.assignedTeamId ?? null,
				officiatingTeamName:
					teamRows.find((team) => team.id === assignment?.assignedTeamId)?.name ?? null,
				officiatingNote: assignment?.note ?? null,
				rubberCount
			};
		})
	);
}

export async function listGroupTies(db: AppDb, groupCode: GroupCode): Promise<TieSummary[]> {
	return listTies(db, groupCode === 'A' ? 'group_a' : 'group_b');
}

export async function getTieWithRubbers(db: AppDb, tieId: string) {
	const tie = await db.query.ties.findFirst({ where: eq(ties.id, tieId) });
	if (!tie) return null;
	const rubberRows = await db
		.select()
		.from(rubbers)
		.where(eq(rubbers.tieId, tie.id))
		.orderBy(asc(rubbers.displayOrder));
	return { tie, rubbers: rubberRows };
}

export async function updateTieSchedule(
	db: AppDb,
	input: {
		id: string;
		tieCode: string;
		scheduledStartAt?: string | null;
		venue?: 'first_gym' | 'second_gym' | null;
		courtBlockCode?: string | null;
		lineupDueAt?: string | null;
		operationNote?: string | null;
		scheduleChanged?: boolean;
		now: string;
	}
) {
	await db
		.update(ties)
		.set({
			tieCode: input.tieCode,
			scheduledStartAt: input.scheduledStartAt ?? null,
			venue: input.venue ?? null,
			courtBlockCode: input.courtBlockCode ?? null,
			lineupDueAt: input.lineupDueAt ?? null,
			operationNote: input.operationNote ?? null,
			scheduleChanged: input.scheduleChanged ?? false,
			updatedAt: input.now
		})
		.where(eq(ties.id, input.id));
}

export async function assignOfficiatingTeam(
	db: AppDb,
	input: {
		tieId: string;
		assignedTeamId: string | null;
		note?: string | null;
		now: string;
	}
) {
	const existing = await db.query.officiatingAssignments.findFirst({
		where: and(
			eq(officiatingAssignments.tieId, input.tieId),
			eq(officiatingAssignments.role, 'umpire_team')
		)
	});
	if (!existing) {
		await db.insert(officiatingAssignments).values({
			id: crypto.randomUUID(),
			tieId: input.tieId,
			assignedTeamId: input.assignedTeamId,
			role: 'umpire_team',
			status: nextOfficiatingAssignmentStatus({
				existing: null,
				assignedTeamId: input.assignedTeamId,
				note: input.note ?? null
			}),
			note: input.note ?? null,
			createdAt: input.now,
			updatedAt: input.now
		});
		return;
	}

	await db
		.update(officiatingAssignments)
		.set({
			assignedTeamId: input.assignedTeamId,
			note: input.note ?? null,
			status: nextOfficiatingAssignmentStatus({
				existing,
				assignedTeamId: input.assignedTeamId,
				note: input.note ?? null
			}),
			updatedAt: input.now
		})
		.where(eq(officiatingAssignments.id, existing.id));
}

export async function setGroupStandingOverride(
	db: AppDb,
	input: {
		groupCode: GroupCode;
		teamId: string;
		manualRank: number;
		reason?: string | null;
		now: string;
	}
) {
	const existing = await db.query.groupStandingOverrides.findFirst({
		where: and(
			eq(groupStandingOverrides.groupCode, input.groupCode),
			eq(groupStandingOverrides.teamId, input.teamId)
		)
	});
	if (!existing) {
		await db.insert(groupStandingOverrides).values({
			id: crypto.randomUUID(),
			groupCode: input.groupCode,
			teamId: input.teamId,
			manualRank: input.manualRank,
			reason: input.reason ?? null,
			createdAt: input.now,
			updatedAt: input.now
		});
		return;
	}

	await db
		.update(groupStandingOverrides)
		.set({ manualRank: input.manualRank, reason: input.reason ?? null, updatedAt: input.now })
		.where(eq(groupStandingOverrides.id, existing.id));
}

export async function listRankingTiebreakers(
	db: AppDb,
	groupCode?: GroupCode
): Promise<RankingTiebreaker[]> {
	return groupCode
		? db
				.select()
				.from(rankingTiebreakers)
				.where(eq(rankingTiebreakers.groupCode, groupCode))
				.orderBy(asc(rankingTiebreakers.createdAt))
		: db.select().from(rankingTiebreakers).orderBy(asc(rankingTiebreakers.createdAt));
}

export async function getDashboard(db: AppDb) {
	await ensureDefaultSettings(db);
	const [teamRows, tieRows] = await Promise.all([listTeams(db), listTies(db)]);
	const groupA = tieRows.filter((tie) => tie.phase === 'group_a');
	const groupB = tieRows.filter((tie) => tie.phase === 'group_b');
	const finals = tieRows.filter((tie) =>
		['semifinal', 'final', 'third_place', 'fifth_place'].includes(tie.phase)
	);
	return {
		settings: await db.query.appSettings.findFirst({ where: eq(appSettings.id, 'default') }),
		teams: teamRows,
		ties: tieRows,
		groupA,
		groupB,
		finals,
		lineupPending: tieRows.filter((tie) => tie.status === 'lineup_pending'),
		playing: tieRows.filter((tie) => tie.status === 'playing'),
		confirmPending: tieRows.filter((tie) => tie.status === 'finished'),
		officiatingMissing: listUnassignedOfficiatingTies(tieRows),
		scheduleChanged: tieRows.filter((tie) => tie.scheduleChanged)
	};
}
