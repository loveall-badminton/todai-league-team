import { now as nowIso } from '$lib/utils/now';
import { eq } from 'drizzle-orm';
import { FINAL_TIE_DEFINITIONS } from '$lib/domain/tokyoLeague';
import type { TieStatus } from '$lib/domain/tieProgress';
import { getRequestDb } from '$lib/server/db/request';
import { teams, ties } from '$lib/server/db/schema';
import { createTieWithRubbers, ensureRubbersForTie } from './tieService';
import { ensureDefaultSettings } from './tokyoLeagueSetupService';

export type FinalsStandingSeed = {
	rank: number | null;
	teamId: string;
	requiresTiebreaker?: boolean;
};

export type FinalTieAssignment = {
	tieCode: string;
	phase: 'semifinal' | 'final' | 'third_place' | 'fifth_place';
	roundLabel: string;
	teamAId: string | null;
	teamBId: string | null;
	displayOrder: number;
};

export type SemifinalResultSource = {
	tieCode: string;
	status: TieStatus;
	teamAId: string | null;
	teamBId: string | null;
	winnerTeamId: string | null;
};

export type ManualSemifinalAssignments = {
	x1TeamAId: string;
	x1TeamBId: string;
	x2TeamAId: string;
	x2TeamBId: string;
};

export type ManualFifthPlaceAssignment = {
	x3TeamAId: string;
	x3TeamBId: string;
};

export function assertFinalAssignmentsReady(assignments: FinalTieAssignment[]) {
	const missing = assignments.find((assignment) => !assignment.teamAId || !assignment.teamBId);
	if (missing) {
		throw new Error('出場チームをすべて選択してください');
	}
}

export function buildSemifinalsAndFifthPlaceAssignments(
	standingA: FinalsStandingSeed[],
	standingB: FinalsStandingSeed[]
): FinalTieAssignment[] {
	const teamBySource = new Map([
		['A1', teamAtRank(standingA, 1)],
		['A2', teamAtRank(standingA, 2)],
		['A3', teamAtRank(standingA, 3)],
		['B1', teamAtRank(standingB, 1)],
		['B2', teamAtRank(standingB, 2)],
		['B3', teamAtRank(standingB, 3)]
	]);

	return FINAL_TIE_DEFINITIONS.slice(0, 3).map((definition) => ({
		tieCode: definition.tieCode,
		phase: definition.phase,
		roundLabel: definition.roundLabel,
		teamAId: teamBySource.get(definition.teamASource) ?? null,
		teamBId: teamBySource.get(definition.teamBSource) ?? null,
		displayOrder: Number(definition.tieCode.replace('X-', ''))
	}));
}

export function buildSemifinalsAndFifthPlaceSuggestions(
	standingA: FinalsStandingSeed[],
	standingB: FinalsStandingSeed[]
): FinalTieAssignment[] {
	const teamBySource = new Map([
		['A1', standingA[0]?.teamId ?? null],
		['A2', standingA[1]?.teamId ?? null],
		['A3', standingA[2]?.teamId ?? null],
		['B1', standingB[0]?.teamId ?? null],
		['B2', standingB[1]?.teamId ?? null],
		['B3', standingB[2]?.teamId ?? null]
	]);

	return FINAL_TIE_DEFINITIONS.slice(0, 3).map((definition) => ({
		tieCode: definition.tieCode,
		phase: definition.phase,
		roundLabel: definition.roundLabel,
		teamAId: teamBySource.get(definition.teamASource) ?? null,
		teamBId: teamBySource.get(definition.teamBSource) ?? null,
		displayOrder: Number(definition.tieCode.replace('X-', ''))
	}));
}

export function buildManualSemifinalAssignments(
	input: ManualSemifinalAssignments
): FinalTieAssignment[] {
	const teamsByTieCode = new Map([
		['X-1', { teamAId: input.x1TeamAId, teamBId: input.x1TeamBId }],
		['X-2', { teamAId: input.x2TeamAId, teamBId: input.x2TeamBId }]
	]);

	return FINAL_TIE_DEFINITIONS.slice(0, 2).map((definition) => {
		const teamsForTie = teamsByTieCode.get(definition.tieCode);
		return {
			tieCode: definition.tieCode,
			phase: definition.phase,
			roundLabel: definition.roundLabel,
			teamAId: teamsForTie?.teamAId ?? null,
			teamBId: teamsForTie?.teamBId ?? null,
			displayOrder: Number(definition.tieCode.replace('X-', ''))
		};
	});
}

export function buildManualFifthPlaceAssignment(
	input: ManualFifthPlaceAssignment
): FinalTieAssignment[] {
	const definition = FINAL_TIE_DEFINITIONS[2];
	return [
		{
			tieCode: definition.tieCode,
			phase: definition.phase,
			roundLabel: definition.roundLabel,
			teamAId: input.x3TeamAId,
			teamBId: input.x3TeamBId,
			displayOrder: Number(definition.tieCode.replace('X-', ''))
		}
	];
}

export function buildFinalAndThirdPlaceAssignments(
	semi1: SemifinalResultSource,
	semi2: SemifinalResultSource
): FinalTieAssignment[] {
	if (!isResultReady(semi1) || !isResultReady(semi2)) {
		throw new Error('準決勝1・準決勝2の結果確定後に生成できます');
	}

	const semi1Loser = loserTeamId(semi1);
	const semi2Loser = loserTeamId(semi2);
	if (!semi1.winnerTeamId || !semi2.winnerTeamId || !semi1Loser || !semi2Loser) {
		throw new Error('準決勝の勝敗が未確定です');
	}

	const assignments: FinalTieAssignment[] = [
		{
			tieCode: 'X-4',
			phase: 'third_place',
			roundLabel: '3位決定戦',
			teamAId: semi1Loser,
			teamBId: semi2Loser,
			displayOrder: 4
		},
		{
			tieCode: 'X-5',
			phase: 'final',
			roundLabel: '決勝',
			teamAId: semi1.winnerTeamId,
			teamBId: semi2.winnerTeamId,
			displayOrder: 5
		}
	];
	assertFinalAssignmentsReady(assignments);
	return assignments;
}

export async function generateSemifinals(input: ManualSemifinalAssignments, now = nowIso()) {
	const settings = await ensureDefaultSettings(now);
	if (!settings.knockoutScoringRuleId) throw new Error('決勝トーナメント得点ルールが未設定です');

	const assignments = buildManualSemifinalAssignments(input);
	assertFinalAssignmentsReady(assignments);
	await assertSelectedTeamsAreValid(assignments);

	let changed = 0;
	for (const assignment of assignments) {
		await upsertFinalTie({
			tieCode: assignment.tieCode,
			phase: assignment.phase,
			roundLabel: assignment.roundLabel,
			teamAId: assignment.teamAId,
			teamBId: assignment.teamBId,
			scoringRuleId: settings.knockoutScoringRuleId,
			displayOrder: assignment.displayOrder,
			now
		});
		changed += 1;
	}
	return changed;
}

export async function generateFifthPlace(input: ManualFifthPlaceAssignment, now = nowIso()) {
	const settings = await ensureDefaultSettings(now);
	if (!settings.knockoutScoringRuleId) throw new Error('決勝トーナメント得点ルールが未設定です');

	const assignments = buildManualFifthPlaceAssignment(input);
	assertFinalAssignmentsReady(assignments);
	await assertSelectedTeamsAreValid(assignments);

	let changed = 0;
	for (const assignment of assignments) {
		await upsertFinalTie({
			tieCode: assignment.tieCode,
			phase: assignment.phase,
			roundLabel: assignment.roundLabel,
			teamAId: assignment.teamAId,
			teamBId: assignment.teamBId,
			scoringRuleId: settings.knockoutScoringRuleId,
			displayOrder: assignment.displayOrder,
			now
		});
		changed += 1;
	}
	return changed;
}

async function assertSelectedTeamsAreValid(assignments: FinalTieAssignment[]) {
	const db = getRequestDb();
	const existingAssignments = await Promise.all(
		FINAL_TIE_DEFINITIONS.slice(0, 3).map(async (definition) => {
			if (assignments.some((assignment) => assignment.tieCode === definition.tieCode)) return null;
			return db.query.ties.findFirst({ where: eq(ties.tieCode, definition.tieCode) });
		})
	);
	const allAssignments = [
		...assignments,
		...existingAssignments.filter(
			(assignment): assignment is NonNullable<typeof assignment> => !!assignment
		)
	];

	const selectedTeamIds = allAssignments.flatMap((assignment) => [
		assignment.teamAId,
		assignment.teamBId
	]);
	const normalizedTeamIds = selectedTeamIds.filter((teamId): teamId is string => !!teamId);
	if (new Set(normalizedTeamIds).size !== normalizedTeamIds.length) {
		throw new Error('同じチームを複数の枠に選択することはできません');
	}

	for (const teamId of normalizedTeamIds) {
		const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
		if (!team) throw new Error('選択されたチームが見つかりません');
	}
}

export async function generateFinalAndThirdPlace(now = nowIso()) {
	const db = getRequestDb();
	const settings = await ensureDefaultSettings(now);
	if (!settings.knockoutScoringRuleId) throw new Error('決勝トーナメント得点ルールが未設定です');

	const semi1 = await db.query.ties.findFirst({ where: eq(ties.tieCode, 'X-1') });
	const semi2 = await db.query.ties.findFirst({ where: eq(ties.tieCode, 'X-2') });
	if (!semi1 || !semi2) throw new Error('準決勝を先に生成してください');
	const assignments = buildFinalAndThirdPlaceAssignments(semi1, semi2);

	for (const assignment of assignments) {
		await upsertFinalTie({
			tieCode: assignment.tieCode,
			phase: assignment.phase,
			roundLabel: assignment.roundLabel,
			teamAId: assignment.teamAId,
			teamBId: assignment.teamBId,
			scoringRuleId: settings.knockoutScoringRuleId,
			displayOrder: assignment.displayOrder,
			now
		});
	}
	return assignments.length;
}

async function upsertFinalTie(params: {
	tieCode: string;
	phase: 'semifinal' | 'final' | 'third_place' | 'fifth_place';
	roundLabel: string;
	teamAId: string | null;
	teamBId: string | null;
	scoringRuleId: string;
	displayOrder: number;
	now: string;
}) {
	const db = getRequestDb();
	const existing = await db.query.ties.findFirst({ where: eq(ties.tieCode, params.tieCode) });
	if (!existing) {
		await createTieWithRubbers({
			tieCode: params.tieCode,
			phase: params.phase,
			roundLabel: params.roundLabel,
			teamAId: params.teamAId,
			teamBId: params.teamBId,
			scoringRuleId: params.scoringRuleId,
			displayOrder: params.displayOrder,
			now: params.now
		});
		return;
	}

	await db
		.update(ties)
		.set({
			phase: params.phase,
			roundLabel: params.roundLabel,
			teamAId: params.teamAId,
			teamBId: params.teamBId,
			displayOrder: params.displayOrder,
			updatedAt: params.now
		})
		.where(eq(ties.id, existing.id));
	await ensureRubbersForTie({
		tieId: existing.id,
		scoringRuleId: params.scoringRuleId,
		now: params.now
	});
}

function teamAtRank(standings: FinalsStandingSeed[], rank: number) {
	const row = standings.find((standing) => standing.rank === rank);
	if (!row || row.requiresTiebreaker) return null;
	return row.teamId;
}

function isResultReady(tie: Pick<typeof ties.$inferSelect, 'status'>) {
	return tie.status === 'finished' || tie.status === 'confirmed';
}

function loserTeamId(tie: Pick<typeof ties.$inferSelect, 'teamAId' | 'teamBId' | 'winnerTeamId'>) {
	if (!tie.teamAId || !tie.teamBId || !tie.winnerTeamId) return null;
	return tie.winnerTeamId === tie.teamAId ? tie.teamBId : tie.teamAId;
}
