import type { GroupCode, TiePhase } from '$lib/domain/tokyoLeague';
import { getRequestDb } from '$lib/server/db/request';
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
import { ensureDefaultSettings } from '$lib/server/services/tokyoLeagueSetupService';
import { and, asc, count, eq, inArray, or } from 'drizzle-orm';

export type Team = typeof teams.$inferSelect;
export type TeamPlayer = typeof teamPlayers.$inferSelect;
export type Tie = typeof ties.$inferSelect;
export type ScoringRule = typeof scoringRules.$inferSelect;
export type RankingTiebreaker = typeof rankingTiebreakers.$inferSelect;

export interface TeamSummary extends Team {
	playerCount: number;
}

export interface TieSummary extends Tie {
	teamAName: string | null;
	teamBName: string | null;
	officiatingTeamId: string | null;
	officiatingTeamName: string | null;
	officiatingTeamIds: string[];
	officiatingTeamNames: string[];
	officiatingNote: string | null;
	rubberCount: number;
}

export async function getLeagueSettings() {
	return ensureDefaultSettings();
}

export async function listScoringRules(): Promise<ScoringRule[]> {
	const db = getRequestDb();
	await ensureDefaultSettings();
	return db.select().from(scoringRules).orderBy(asc(scoringRules.code));
}

export async function updateLeagueSettings(input: {
	eventName: string;
	groupStageScoringRuleId: string | null;
	knockoutScoringRuleId: string | null;
	tiebreakerScoringRuleId: string | null;
	lineupRevealPolicy: 'on_tie_start' | 'manual';
	defaultLineupDueMinutesBefore: number;
	now: string;
}) {
	const db = getRequestDb();
	await ensureDefaultSettings(input.now);
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

export async function updateScoringRule(input: {
	id: string;
	name: string;
	maxGames: number;
	gamesToWin: number;
	pointsToWin: number;
	winBy: number;
	maxPoints: number;
	midGameIntervalPoint: number;
	now: string;
}) {
	const db = getRequestDb();
	await ensureDefaultSettings(input.now);
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

export async function listTeams(): Promise<TeamSummary[]> {
	const db = getRequestDb();
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

export async function listTeamsByGroup(groupCode: GroupCode): Promise<TeamSummary[]> {
	const all = await listTeams();
	return all.filter((team) => team.groupCode === groupCode && team.status === 'active');
}

export async function getTeamWithPlayers(teamId: string) {
	const db = getRequestDb();
	const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
	if (!team) return null;
	const players = await db
		.select()
		.from(teamPlayers)
		.where(eq(teamPlayers.teamId, teamId))
		.orderBy(asc(teamPlayers.displayOrder), asc(teamPlayers.name));
	return { team, players };
}

export async function createTeam(input: {
	name: string;
	shortName?: string | null;
	groupCode?: GroupCode | null;
	displayOrder?: number;
	now: string;
}) {
	const db = getRequestDb();
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

export async function updateTeam(input: {
	id: string;
	name: string;
	shortName?: string | null;
	groupCode?: GroupCode | null;
	displayOrder?: number;
	status?: 'active' | 'withdrawn';
	now: string;
}) {
	const db = getRequestDb();
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

export async function createTeamPlayer(input: {
	teamId: string;
	name: string;
	gender?: 'male' | 'female' | 'unknown';
	displayOrder?: number;
	now: string;
}) {
	const db = getRequestDb();
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

export async function bulkCreateTeamPlayers(input: {
	teamId: string;
	names: string[];
	gender?: 'male' | 'female' | 'unknown';
	displayOrderStart: number;
	now: string;
}): Promise<number> {
	const db = getRequestDb();
	if (input.names.length === 0) return 0;

	const rows = input.names.map((name, i) => ({
		id: crypto.randomUUID(),
		teamId: input.teamId,
		name,
		gender: input.gender ?? ('unknown' as const),
		displayOrder: input.displayOrderStart + i,
		createdAt: input.now,
		updatedAt: input.now
	}));

	await db.insert(teamPlayers).values(rows);
	return rows.length;
}

export async function updateTeamPlayer(input: {
	id: string;
	name: string;
	gender: 'male' | 'female' | 'unknown';
	displayOrder?: number;
	status: 'active' | 'inactive';
	now: string;
}) {
	const db = getRequestDb();
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

export async function reorderTeams(orderedIds: string[], now: string) {
	const db = getRequestDb();
	for (let i = 0; i < orderedIds.length; i++) {
		await db
			.update(teams)
			.set({ displayOrder: i, updatedAt: now })
			.where(eq(teams.id, orderedIds[i]));
	}
}

export async function reorderTeamPlayers(orderedIds: string[], now: string) {
	const db = getRequestDb();
	for (let i = 0; i < orderedIds.length; i++) {
		await db
			.update(teamPlayers)
			.set({ displayOrder: i, updatedAt: now })
			.where(eq(teamPlayers.id, orderedIds[i]));
	}
}

export async function deleteTeam(teamId: string) {
	const db = getRequestDb();
	await db.delete(teams).where(eq(teams.id, teamId));
}

export async function deleteTeamPlayer(playerId: string) {
	const db = getRequestDb();
	await db.delete(teamPlayers).where(eq(teamPlayers.id, playerId));
}

export async function deleteTie(tieId: string) {
	const db = getRequestDb();
	await db.delete(ties).where(eq(ties.id, tieId));
}

export async function reorderTies(orderedIds: string[], now: string) {
	const db = getRequestDb();
	for (let i = 0; i < orderedIds.length; i++) {
		await db
			.update(ties)
			.set({ displayOrder: i, updatedAt: now })
			.where(eq(ties.id, orderedIds[i]));
	}
}

export async function listTies(phase?: TiePhase): Promise<TieSummary[]> {
	const db = getRequestDb();
	const tieRows = phase
		? await db
				.select()
				.from(ties)
				.where(eq(ties.phase, phase))
				.orderBy(asc(ties.displayOrder), asc(ties.tieCode))
		: await db.select().from(ties).orderBy(asc(ties.displayOrder), asc(ties.tieCode));
	const teamRows = await db.select().from(teams);
	const rubberRows = tieRows.length
		? await db
				.select({
					tieId: rubbers.tieId,
					winnerSide: rubbers.winnerSide
				})
				.from(rubbers)
				.where(
					inArray(
						rubbers.tieId,
						tieRows.map((tie) => tie.id)
					)
				)
		: [];
	const summaryByTieId = summarizeTieSummaries(tieRows, rubberRows);

	return Promise.all(
		tieRows.map(async (tie) => {
			const assignments = await db
				.select()
				.from(officiatingAssignments)
				.where(
					and(
						eq(officiatingAssignments.tieId, tie.id),
						eq(officiatingAssignments.role, 'umpire_team')
					)
				)
				.orderBy(asc(officiatingAssignments.createdAt));
			const assignment = assignments[0] ?? null;
			const assignedTeamIds = assignments
				.map((row) => row.assignedTeamId)
				.filter((id): id is string => !!id);
			const assignedTeamNames = assignedTeamIds
				.map((id) => teamRows.find((team) => team.id === id)?.name)
				.filter((name): name is string => !!name);
			const summary = summaryByTieId.get(tie.id) ?? {
				rubberCount: 0,
				teamScoreA: tie.teamScoreA,
				teamScoreB: tie.teamScoreB,
				winnerTeamId: tie.winnerTeamId
			};

			return {
				...tie,
				teamScoreA: summary.teamScoreA,
				teamScoreB: summary.teamScoreB,
				winnerTeamId: summary.winnerTeamId,
				teamAName: teamRows.find((team) => team.id === tie.teamAId)?.name ?? null,
				teamBName: teamRows.find((team) => team.id === tie.teamBId)?.name ?? null,
				officiatingTeamId: assignedTeamIds[0] ?? null,
				officiatingTeamName: assignedTeamNames[0] ?? null,
				officiatingTeamIds: assignedTeamIds,
				officiatingTeamNames: assignedTeamNames,
				officiatingNote: assignment?.note ?? null,
				rubberCount: summary.rubberCount
			};
		})
	);
}

export async function listGroupTies(groupCode: GroupCode): Promise<TieSummary[]> {
	return listTies(groupCode === 'A' ? 'group_a' : 'group_b');
}

export async function getTieWithRubbers(tieId: string) {
	const db = getRequestDb();
	const tie = await db.query.ties.findFirst({ where: eq(ties.id, tieId) });
	if (!tie) return null;
	const rubberRows = await db
		.select()
		.from(rubbers)
		.where(eq(rubbers.tieId, tie.id))
		.orderBy(asc(rubbers.displayOrder));
	const summary = summarizeTieSummaries(
		[tie],
		rubberRows.map((rubber) => ({ tieId: rubber.tieId, winnerSide: rubber.winnerSide }))
	).get(tie.id);
	return {
		tie: summary
			? {
					...tie,
					teamScoreA: summary.teamScoreA,
					teamScoreB: summary.teamScoreB,
					winnerTeamId: summary.winnerTeamId
				}
			: tie,
		rubbers: rubberRows
	};
}

function summarizeTieSummaries(
	tieRows: Pick<Tie, 'id' | 'teamAId' | 'teamBId'>[],
	rubberRows: Pick<typeof rubbers.$inferSelect, 'tieId' | 'winnerSide'>[]
) {
	const summaries = new Map<
		string,
		{ rubberCount: number; teamScoreA: number; teamScoreB: number; winnerTeamId: string | null }
	>();

	for (const tie of tieRows) {
		summaries.set(tie.id, {
			rubberCount: 0,
			teamScoreA: 0,
			teamScoreB: 0,
			winnerTeamId: null
		});
	}

	for (const rubber of rubberRows) {
		const summary = summaries.get(rubber.tieId);
		if (!summary) continue;
		summary.rubberCount += 1;
		if (rubber.winnerSide === 'A') summary.teamScoreA += 1;
		if (rubber.winnerSide === 'B') summary.teamScoreB += 1;
	}

	for (const tie of tieRows) {
		const summary = summaries.get(tie.id);
		if (!summary) continue;
		if (summary.teamScoreA >= 3) summary.winnerTeamId = tie.teamAId ?? null;
		else if (summary.teamScoreB >= 3) summary.winnerTeamId = tie.teamBId ?? null;
	}

	return summaries;
}

export async function updateTieSchedule(input: {
	id: string;
	tieCode: string;
	scheduledStartAt?: string | null;
	venue?: 'first_gym' | 'second_gym' | null;
	courtBlockCode?: string | null;
	lineupDueAt?: string | null;
	operationNote?: string | null;
	scheduleChanged?: boolean;
	now: string;
}) {
	const db = getRequestDb();
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

export async function assignOfficiatingTeams(input: {
	tieId: string;
	assignedTeamIds: string[];
	note?: string | null;
	now: string;
}) {
	const db = getRequestDb();
	const existing = await db.query.officiatingAssignments.findMany({
		where: and(
			eq(officiatingAssignments.tieId, input.tieId),
			eq(officiatingAssignments.role, 'umpire_team')
		)
	});
	const assignedTeamIds = [...new Set(input.assignedTeamIds.filter(Boolean))];
	const existingTeamIds = existing
		.map((assignment) => assignment.assignedTeamId)
		.filter((id): id is string => !!id);
	const changed =
		existingTeamIds.length !== assignedTeamIds.length ||
		existingTeamIds.some((id) => !assignedTeamIds.includes(id)) ||
		assignedTeamIds.some((id) => !existingTeamIds.includes(id)) ||
		existing.some((assignment) => (assignment.note ?? null) !== (input.note ?? null));
	const status: 'scheduled' | 'changed' =
		changed && existing.some((assignment) => assignment.status === 'confirmed')
			? 'changed'
			: 'scheduled';

	await db
		.delete(officiatingAssignments)
		.where(
			and(
				eq(officiatingAssignments.tieId, input.tieId),
				eq(officiatingAssignments.role, 'umpire_team')
			)
		);

	if (assignedTeamIds.length === 0) return;

	await db.insert(officiatingAssignments).values(
		assignedTeamIds.map((assignedTeamId) => ({
			id: crypto.randomUUID(),
			tieId: input.tieId,
			assignedTeamId,
			role: 'umpire_team' as const,
			status,
			note: input.note ?? null,
			createdAt: input.now,
			updatedAt: input.now
		}))
	);
}

export async function setGroupStandingOverride(input: {
	groupCode: GroupCode;
	teamId: string;
	manualRank: number;
	reason?: string | null;
	now: string;
}) {
	const db = getRequestDb();
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

export async function listRankingTiebreakers(groupCode?: GroupCode): Promise<RankingTiebreaker[]> {
	const db = getRequestDb();
	return groupCode
		? db
				.select()
				.from(rankingTiebreakers)
				.where(eq(rankingTiebreakers.groupCode, groupCode))
				.orderBy(asc(rankingTiebreakers.createdAt))
		: db.select().from(rankingTiebreakers).orderBy(asc(rankingTiebreakers.createdAt));
}

export async function getTeam(teamId: string): Promise<Team | null> {
	const db = getRequestDb();
	const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
	return team ?? null;
}

export async function listPlayersByIds(ids: string[]): Promise<TeamPlayer[]> {
	if (ids.length === 0) return [];
	const db = getRequestDb();
	return db.select().from(teamPlayers).where(inArray(teamPlayers.id, ids));
}

export async function listPlayersForTeam(teamId: string): Promise<TeamPlayer[]> {
	const db = getRequestDb();
	return db
		.select()
		.from(teamPlayers)
		.where(eq(teamPlayers.teamId, teamId))
		.orderBy(asc(teamPlayers.displayOrder), asc(teamPlayers.name));
}

export async function listAllTeamsWithPlayers(): Promise<{ team: Team; players: TeamPlayer[] }[]> {
	const db = getRequestDb();
	const allTeams = await db.select().from(teams).orderBy(asc(teams.displayOrder), asc(teams.name));
	return Promise.all(
		allTeams.map(async (team) => {
			const players = await db
				.select()
				.from(teamPlayers)
				.where(eq(teamPlayers.teamId, team.id))
				.orderBy(asc(teamPlayers.displayOrder), asc(teamPlayers.name));
			return { team, players };
		})
	);
}

export async function listTiesForTeam(teamId: string): Promise<Tie[]> {
	const db = getRequestDb();
	return db
		.select()
		.from(ties)
		.where(or(eq(ties.teamAId, teamId), eq(ties.teamBId, teamId)))
		.orderBy(asc(ties.displayOrder), asc(ties.tieCode));
}

export async function listOfficiatingTieIds(teamId: string): Promise<string[]> {
	const db = getRequestDb();
	const rows = await db
		.select({ tieId: officiatingAssignments.tieId })
		.from(officiatingAssignments)
		.where(
			and(
				eq(officiatingAssignments.assignedTeamId, teamId),
				eq(officiatingAssignments.role, 'umpire_team')
			)
		);
	return [...new Set(rows.map((row) => row.tieId))];
}

export async function listTiesByIds(ids: string[]): Promise<Tie[]> {
	if (ids.length === 0) return [];
	const db = getRequestDb();
	return db
		.select()
		.from(ties)
		.where(inArray(ties.id, ids))
		.orderBy(asc(ties.displayOrder), asc(ties.tieCode));
}

export async function getOfficiatingAssignment(tieId: string): Promise<{
	assignedTeamId: string | null;
	assignedTeamIds: string[];
	note: string | null;
} | null> {
	const db = getRequestDb();
	const assignments = await db.query.officiatingAssignments.findMany({
		where: and(
			eq(officiatingAssignments.tieId, tieId),
			eq(officiatingAssignments.role, 'umpire_team')
		),
		orderBy: [asc(officiatingAssignments.createdAt)]
	});
	if (assignments.length === 0) return null;
	const assignedTeamIds = assignments
		.map((assignment) => assignment.assignedTeamId)
		.filter((id): id is string => !!id);
	return {
		assignedTeamId: assignedTeamIds[0] ?? null,
		assignedTeamIds,
		note: assignments[0]?.note ?? null
	};
}
