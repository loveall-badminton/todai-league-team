import { eq } from 'drizzle-orm';
import type { GroupCode } from '$lib/domain/tokyoLeague';
import type { ScoringConfig } from '$lib/domain/types';
import { getRequestDb } from '$lib/server/db/request';
import { createMatchWithPlayers } from '$lib/server/repositories/matchRepository';
import {
	matches,
	rankingTiebreakers,
	scoringRules,
	teamPlayers,
	teams,
	tournaments
} from '$lib/server/db/schema';
import { rubberStatusFromMatchResultStatus } from '$lib/server/services/tieOperationService';
import { ensureDefaultSettings } from './tokyoLeagueSetupService';

const internalTournamentId = 'tokyo-league-default';

export type RankingTiebreakerTeamForValidation = {
	id: string;
};

export type RankingTiebreakerPlayerForValidation = {
	id: string;
	teamId: string;
};

export function validateRankingTiebreakerSelection<
	TTeam extends RankingTiebreakerTeamForValidation,
	TPlayer extends RankingTiebreakerPlayerForValidation
>(params: {
	teamA: TTeam | null | undefined;
	teamB: TTeam | null | undefined;
	playerA: TPlayer | null | undefined;
	playerB: TPlayer | null | undefined;
}) {
	const { teamA, teamB, playerA, playerB } = params;
	if (!teamA || !teamB || !playerA || !playerB) throw new Error('チームまたは選手が見つかりません');
	if (teamA.id === teamB.id) throw new Error('順位決定再試合は異なるチーム間で作成してください');
	if (playerA.teamId !== teamA.id || playerB.teamId !== teamB.id) {
		throw new Error('再試合選手は対象チーム所属から選択してください');
	}
	return { teamA, teamB, playerA, playerB };
}

export async function createRankingTiebreaker(params: {
	groupCode: GroupCode;
	reason: string;
	teamAId: string;
	teamBId: string;
	playerAId: string;
	playerBId: string;
	now?: string;
}) {
	const db = getRequestDb();
	const now = params.now ?? new Date().toISOString();
	const settings = await ensureDefaultSettings(now);
	if (!settings.tiebreakerScoringRuleId) throw new Error('順位決定再試合ルールが未設定です');
	const scoringRule = await db.query.scoringRules.findFirst({
		where: eq(scoringRules.id, settings.tiebreakerScoringRuleId)
	});
	if (!scoringRule) throw new Error('順位決定再試合ルールが見つかりません');

	const [teamA, teamB, playerA, playerB] = await Promise.all([
		db.query.teams.findFirst({ where: eq(teams.id, params.teamAId) }),
		db.query.teams.findFirst({ where: eq(teams.id, params.teamBId) }),
		db.query.teamPlayers.findFirst({ where: eq(teamPlayers.id, params.playerAId) }),
		db.query.teamPlayers.findFirst({ where: eq(teamPlayers.id, params.playerBId) })
	]);
	const validated = validateRankingTiebreakerSelection({ teamA, teamB, playerA, playerB });

	await ensureInternalTournament(now);
	const rankingTiebreakerId = crypto.randomUUID();
	await db.insert(rankingTiebreakers).values({
		id: rankingTiebreakerId,
		groupCode: params.groupCode,
		reason: params.reason,
		teamAId: validated.teamA.id,
		teamBId: validated.teamB.id,
		status: 'scheduled',
		createdAt: now,
		updatedAt: now
	});

	const matchId = await createMatchWithPlayers({
		tournamentId: internalTournamentId,
		courtId: null,
		discipline: 'MS',
		eventName: `${params.groupCode}リーグ順位決定再試合`,
		category: params.reason,
		roundName: `${validated.teamA.name} vs ${validated.teamB.name}`,
		rankingTiebreakerId,
		scoringRuleId: scoringRule.id,
		scoring: scoringConfigFromRule(scoringRule),
		players: [
			{ side: 'A', order: 1, name: validated.playerA.name, teamName: validated.teamA.name },
			{ side: 'B', order: 1, name: validated.playerB.name, teamName: validated.teamB.name }
		],
		now
	});

	await db
		.update(rankingTiebreakers)
		.set({ matchId, updatedAt: now })
		.where(eq(rankingTiebreakers.id, rankingTiebreakerId));
	return { rankingTiebreakerId, matchId };
}

export async function syncRankingTiebreakerResult(
	matchId: string,
	now = new Date().toISOString()
) {
	const db = getRequestDb();
	const match = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
	if (!match?.rankingTiebreakerId || !match.winnerSide) return;
	const resultStatus = rubberStatusFromMatchResultStatus(match.status);
	if (!resultStatus) return;

	const tiebreaker = await db.query.rankingTiebreakers.findFirst({
		where: eq(rankingTiebreakers.id, match.rankingTiebreakerId)
	});
	if (!tiebreaker) return;

	await db
		.update(rankingTiebreakers)
		.set({
			winnerTeamId: match.winnerSide === 'A' ? tiebreaker.teamAId : tiebreaker.teamBId,
			status: resultStatus,
			updatedAt: now
		})
		.where(eq(rankingTiebreakers.id, tiebreaker.id));
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
