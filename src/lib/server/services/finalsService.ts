import { eq } from 'drizzle-orm';
import { FINAL_TIE_DEFINITIONS } from '$lib/domain/tokyoLeague';
import type { AppDb } from '$lib/server/db/client';
import { ties } from '$lib/server/db/schema';
import { calculateGroupStandings } from './standingService';
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
	status:
		| 'scheduled'
		| 'lineup_pending'
		| 'lineup_submitted'
		| 'ready'
		| 'playing'
		| 'finished'
		| 'confirmed'
		| 'cancelled';
	teamAId: string | null;
	teamBId: string | null;
	winnerTeamId: string | null;
};

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
		displayOrder: Number(definition.tieCode.replace('x-', ''))
	}));
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

	return [
		{
			tieCode: 'x-4',
			phase: 'third_place',
			roundLabel: '3位決定戦',
			teamAId: semi1Loser,
			teamBId: semi2Loser,
			displayOrder: 4
		},
		{
			tieCode: 'x-5',
			phase: 'final',
			roundLabel: '決勝',
			teamAId: semi1.winnerTeamId,
			teamBId: semi2.winnerTeamId,
			displayOrder: 5
		}
	];
}

export async function generateSemifinalsAndFifthPlace(db: AppDb, now = new Date().toISOString()) {
	const settings = await ensureDefaultSettings(db, now);
	if (!settings.knockoutScoringRuleId) throw new Error('決勝系得点ルールが未設定です');

	const [standingA, standingB] = await Promise.all([
		calculateGroupStandings(db, 'A'),
		calculateGroupStandings(db, 'B')
	]);

	let changed = 0;
	for (const assignment of buildSemifinalsAndFifthPlaceAssignments(standingA, standingB)) {
		await upsertFinalTie(db, {
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

export async function generateFinalAndThirdPlace(db: AppDb, now = new Date().toISOString()) {
	const settings = await ensureDefaultSettings(db, now);
	if (!settings.knockoutScoringRuleId) throw new Error('決勝系得点ルールが未設定です');

	const semi1 = await db.query.ties.findFirst({ where: eq(ties.tieCode, 'x-1') });
	const semi2 = await db.query.ties.findFirst({ where: eq(ties.tieCode, 'x-2') });
	if (!semi1 || !semi2) throw new Error('準決勝を先に生成してください');
	const assignments = buildFinalAndThirdPlaceAssignments(semi1, semi2);

	for (const assignment of assignments) {
		await upsertFinalTie(db, {
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

async function upsertFinalTie(
	db: AppDb,
	params: {
		tieCode: string;
		phase: 'semifinal' | 'final' | 'third_place' | 'fifth_place';
		roundLabel: string;
		teamAId: string | null;
		teamBId: string | null;
		scoringRuleId: string;
		displayOrder: number;
		now: string;
	}
) {
	const existing = await db.query.ties.findFirst({ where: eq(ties.tieCode, params.tieCode) });
	if (!existing) {
		await createTieWithRubbers(db, {
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
	await ensureRubbersForTie(db, {
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
