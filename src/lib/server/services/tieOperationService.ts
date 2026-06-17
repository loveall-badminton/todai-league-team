import { and, asc, eq, inArray } from 'drizzle-orm';
import type { ScoringConfig } from '$lib/domain/types';
import { createMatchWithPlayers } from '$lib/server/repositories/matchRepository';
import { getRequestDb } from '$lib/server/db/request';
import {
	lineupItems,
	lineupSubmissions,
	matches,
	rubbers,
	scoringRules,
	teamPlayers,
	teams,
	ties,
	tournaments
} from '$lib/server/db/schema';
import { revealLineups } from './lineupService';

const internalTournamentId = 'tokyo-league-default';
const terminalRubberStatuses = new Set(['finished', 'confirmed', 'skipped', 'cancelled']);
const matchResultStatuses = new Set(['finished', 'confirmed', 'forfeited', 'retired']);
type TieStatus = typeof ties.$inferSelect.status;

export type TieResultInput = {
	teamAId: string | null;
	teamBId: string | null;
	status: TieStatus;
};

export type RubberResultInput = {
	winnerSide: 'A' | 'B' | null;
	status: string;
};

export function calculateTieResult(tie: TieResultInput, rubberRows: RubberResultInput[]) {
	const teamScoreA = rubberRows.filter((rubber) => rubber.winnerSide === 'A').length;
	const teamScoreB = rubberRows.filter((rubber) => rubber.winnerSide === 'B').length;
	const winnerTeamId = teamScoreA >= 3 ? tie.teamAId : teamScoreB >= 3 ? tie.teamBId : null;
	const allDone =
		rubberRows.length === 5 &&
		rubberRows.every((rubber) => terminalRubberStatuses.has(rubber.status));
	return {
		teamScoreA,
		teamScoreB,
		winnerTeamId,
		status: (allDone ? 'finished' : tie.status) as TieStatus,
		allDone
	};
}

export function rubberStatusFromMatchResultStatus(
	matchStatus: string
): 'finished' | 'confirmed' | null {
	if (!matchResultStatuses.has(matchStatus)) return null;
	return matchStatus === 'confirmed' ? 'confirmed' : 'finished';
}

export async function startTie(tieId: string, options: { force?: boolean; now?: string } = {}) {
	const db = getRequestDb();
	const now = options.now ?? new Date().toISOString();
	const tie = await db.query.ties.findFirst({ where: eq(ties.id, tieId) });
	if (!tie) throw new Error('対戦が見つかりません');

	const submissions = await db
		.select()
		.from(lineupSubmissions)
		.where(eq(lineupSubmissions.tieId, tieId));
	const ready =
		submissions.length >= 2 &&
		submissions.every((submission) =>
			['submitted', 'locked', 'revealed'].includes(submission.status)
		);
	if (!ready && !options.force) throw new Error('両チームのオーダー提出が必要です');

	if (!tie.lineupsRevealedAt) {
		await revealLineups(tieId, now);
	}

	await db
		.update(ties)
		.set({ status: 'playing', actualStartAt: tie.actualStartAt ?? now, updatedAt: now })
		.where(eq(ties.id, tieId));
	await db.update(rubbers).set({ status: 'ready', updatedAt: now }).where(eq(rubbers.tieId, tieId));

	// Auto-create scoring matches for all rubbers
	const allRubbers = await db.select().from(rubbers).where(eq(rubbers.tieId, tieId));
	for (const rubber of allRubbers) {
		if (!rubber.matchId) {
			try {
				await createMatchFromRubber(rubber.id, now);
			} catch {
				// continue even if one rubber fails (e.g. missing lineup item)
			}
		}
	}
}

export async function createMatchFromRubber(
	rubberId: string,
	now = new Date().toISOString()
): Promise<string> {
	const db = getRequestDb();
	const rubber = await db.query.rubbers.findFirst({ where: eq(rubbers.id, rubberId) });
	if (!rubber) throw new Error('種目が見つかりません');
	if (rubber.matchId) return rubber.matchId;

	const tie = await db.query.ties.findFirst({ where: eq(ties.id, rubber.tieId) });
	if (!tie) throw new Error('Tie not found');
	if (!tie.lineupsRevealedAt) throw new Error('オーダー公開後にmatchを作成できます');

	const [sideA, sideB] = await Promise.all([
		getLineupPlayersForRubber(tie.id, 'A', rubber.code),
		getLineupPlayersForRubber(tie.id, 'B', rubber.code)
	]);
	const scoringRule = await db.query.scoringRules.findFirst({
		where: eq(scoringRules.id, rubber.scoringRuleId)
	});
	if (!scoringRule) throw new Error('Scoring rule not found');

	await ensureInternalTournament(now);

	const matchId = await createMatchWithPlayers({
		tournamentId: internalTournamentId,
		courtId: null,
		discipline: rubber.discipline,
		eventName: tie.tieCode,
		category: tie.roundLabel,
		roundName: rubber.code,
		rubberId: rubber.id,
		scoringRuleId: rubber.scoringRuleId,
		scoring: scoringConfigFromRule(scoringRule),
		players: [
			...sideA.map((player, index) => ({
				side: 'A' as const,
				order: (index + 1) as 1 | 2,
				name: player.name,
				teamName: player.teamName
			})),
			...sideB.map((player, index) => ({
				side: 'B' as const,
				order: (index + 1) as 1 | 2,
				name: player.name,
				teamName: player.teamName
			}))
		],
		now
	});

	await db
		.update(rubbers)
		.set({ matchId, status: 'scheduled', updatedAt: now })
		.where(eq(rubbers.id, rubber.id));
	return matchId;
}

export async function syncRubberResultFromMatch(matchId: string, now = new Date().toISOString()) {
	const db = getRequestDb();
	const match = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
	if (!match?.rubberId) return;
	const rubberStatus = rubberStatusFromMatchResultStatus(match.status);
	if (!rubberStatus || !match.winnerSide) return;

	await db
		.update(rubbers)
		.set({
			status: rubberStatus,
			winnerSide: match.winnerSide,
			updatedAt: now
		})
		.where(eq(rubbers.id, match.rubberId));

	const rubber = await db.query.rubbers.findFirst({ where: eq(rubbers.id, match.rubberId) });
	if (rubber) await recalculateTieResult(rubber.tieId, now);
}

export async function recalculateTieResult(tieId: string, now = new Date().toISOString()) {
	const db = getRequestDb();
	const tie = await db.query.ties.findFirst({ where: eq(ties.id, tieId) });
	if (!tie) throw new Error('Tie not found');
	const rubberRows = await db
		.select()
		.from(rubbers)
		.where(eq(rubbers.tieId, tieId))
		.orderBy(asc(rubbers.displayOrder));
	const result = calculateTieResult(tie, rubberRows);

	await db
		.update(ties)
		.set({
			teamScoreA: result.teamScoreA,
			teamScoreB: result.teamScoreB,
			winnerTeamId: result.winnerTeamId,
			status: result.status,
			actualEndAt: result.allDone ? (tie.actualEndAt ?? now) : tie.actualEndAt,
			updatedAt: now
		})
		.where(eq(ties.id, tieId));
}

export async function cancelMatchRubber(matchId: string, now = new Date().toISOString()) {
	const db = getRequestDb();
	const match = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
	if (!match?.rubberId) throw new Error('この試合は種目と紐づいていません');
	await db
		.update(matches)
		.set({ status: 'cancelled', updatedAt: now })
		.where(eq(matches.id, matchId));
	await cancelRubber(match.rubberId, now);
}

async function cancelRubber(rubberId: string, now = new Date().toISOString()) {
	const db = getRequestDb();
	const rubber = await db.query.rubbers.findFirst({ where: eq(rubbers.id, rubberId) });
	if (!rubber) throw new Error('種目が見つかりません');
	if (terminalRubberStatuses.has(rubber.status)) {
		throw new Error('すでに終了している種目は打ち切りできません');
	}
	await db
		.update(rubbers)
		.set({ status: 'cancelled', updatedAt: now })
		.where(eq(rubbers.id, rubber.id));
	await recalculateTieResult(rubber.tieId, now);
}

export async function confirmTie(tieId: string, now = new Date().toISOString()) {
	const db = getRequestDb();
	await recalculateTieResult(tieId, now);
	await db.update(ties).set({ status: 'confirmed', updatedAt: now }).where(eq(ties.id, tieId));
}

async function getLineupPlayersForRubber(tieId: string, side: 'A' | 'B', rubberCode: string) {
	const db = getRequestDb();
	const submission = await db.query.lineupSubmissions.findFirst({
		where: and(eq(lineupSubmissions.tieId, tieId), eq(lineupSubmissions.side, side))
	});
	if (!submission || submission.status !== 'revealed') {
		throw new Error(`${side}側のオーダーが公開されていません`);
	}
	const item = await db.query.lineupItems.findFirst({
		where: and(
			eq(lineupItems.submissionId, submission.id),
			eq(lineupItems.rubberCode, rubberCode as never)
		)
	});
	if (!item) throw new Error(`${rubberCode}のオーダーがありません`);
	const players = await db
		.select()
		.from(teamPlayers)
		.where(inArray(teamPlayers.id, [item.player1Id, item.player2Id]));
	const team = await db.query.teams.findFirst({ where: eq(teams.id, submission.teamId) });
	return [item.player1Id, item.player2Id].map((id) => {
		const player = players.find((row) => row.id === id);
		if (!player) throw new Error('選手が見つかりません');
		return { ...player, teamName: team?.name ?? null };
	});
}

async function ensureInternalTournament(now: string) {
	const db = getRequestDb();
	const existing = await db.query.tournaments.findFirst({
		where: eq(tournaments.id, internalTournamentId)
	});
	if (existing) return;
	await db.insert(tournaments).values({
		id: internalTournamentId,
		name: '東大リーグ団体戦',
		status: 'running',
		createdAt: now,
		updatedAt: now
	});
}

function scoringConfigFromRule(rule: typeof scoringRules.$inferSelect): ScoringConfig {
	return {
		maxGames: rule.maxGames,
		gamesToWin: rule.gamesToWin,
		pointsToWin: rule.pointsToWin,
		winBy: rule.winBy,
		maxPoints: rule.maxPoints,
		midGameIntervalPoint: rule.midGameIntervalPoint
	};
}
