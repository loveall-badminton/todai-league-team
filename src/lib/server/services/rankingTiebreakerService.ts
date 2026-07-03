import { eq } from 'drizzle-orm';
import type { MatchDiscipline } from '$lib/domain/types';
import type { GroupCode } from '$lib/domain/tokyoLeague';
import { getRequestDb } from '$lib/server/db/request';
import {
	matches,
	rankingTiebreakers,
	scoringRules,
	teamPlayers,
	teams
} from '$lib/server/db/schema';
import { buildCreateMatchWithPlayersStatementsForId } from '$lib/server/repositories/matchRepository';
import { rubberStatusFromMatchResultStatus } from '$lib/domain/tieProgress';
import {
	INTERNAL_TOURNAMENT_ID,
	ensureDefaultSettings,
	ensureInternalTournament,
	scoringConfigFromRule
} from './tokyoLeagueSetupService';

export type RankingTiebreakerTeamForValidation = {
	id: string;
};

export type RankingTiebreakerPlayerForValidation = {
	id: string;
	teamId: string;
	gender?: 'male' | 'female' | 'unknown';
};

type RankingTiebreakerDiscipline = Extract<MatchDiscipline, 'MD' | 'WD' | 'XD'>;

function assertUniquePlayers(label: string, players: RankingTiebreakerPlayerForValidation[]) {
	if (new Set(players.map((player) => player.id)).size !== players.length) {
		throw new Error(`${label}側の再試合選手が重複しています`);
	}
}

function isEligibleForDiscipline(
	discipline: RankingTiebreakerDiscipline,
	order: 1 | 2,
	player: RankingTiebreakerPlayerForValidation
) {
	if (!player.gender || player.gender === 'unknown') return true;
	if (discipline === 'WD') return player.gender === 'female';
	if (discipline === 'MD') return player.gender === 'male';
	return order === 1 ? player.gender === 'female' : player.gender === 'male';
}

function assertEligiblePlayersForDiscipline(
	discipline: RankingTiebreakerDiscipline,
	playersA: RankingTiebreakerPlayerForValidation[],
	playersB: RankingTiebreakerPlayerForValidation[]
) {
	const allPlayers: Array<{
		side: 'A' | 'B';
		order: 1 | 2;
		player: RankingTiebreakerPlayerForValidation;
	}> = [
		{ side: 'A', order: 1, player: playersA[0] },
		{ side: 'A', order: 2, player: playersA[1] },
		{ side: 'B', order: 1, player: playersB[0] },
		{ side: 'B', order: 2, player: playersB[1] }
	];
	if (allPlayers.some(({ order, player }) => !isEligibleForDiscipline(discipline, order, player))) {
		throw new Error('再試合選手の性別が種目条件に一致していません');
	}
}

export function validateRankingTiebreakerSelection<
	TTeam extends RankingTiebreakerTeamForValidation,
	TPlayer extends RankingTiebreakerPlayerForValidation
>(params: {
	teamA: TTeam | null | undefined;
	teamB: TTeam | null | undefined;
	discipline: RankingTiebreakerDiscipline;
	playersA: (TPlayer | null | undefined)[];
	playersB: (TPlayer | null | undefined)[];
}) {
	const { teamA, teamB, discipline } = params;
	const playersA = params.playersA.filter((player): player is TPlayer => player != null);
	const playersB = params.playersB.filter((player): player is TPlayer => player != null);
	if (!teamA || !teamB || playersA.length !== 2 || playersB.length !== 2) {
		throw new Error('チームまたは選手が見つかりません');
	}
	if (teamA.id === teamB.id) throw new Error('順位決定再試合は異なるチーム間で作成してください');
	assertUniquePlayers('A', playersA);
	assertUniquePlayers('B', playersB);
	if (
		playersA.some((player) => player.teamId !== teamA.id) ||
		playersB.some((player) => player.teamId !== teamB.id)
	) {
		throw new Error('再試合選手は対象チーム所属から選択してください');
	}
	assertEligiblePlayersForDiscipline(discipline, playersA, playersB);
	return { teamA, teamB, playersA, playersB };
}

export async function createRankingTiebreaker(params: {
	groupCode: GroupCode;
	reason: string;
	teamAId: string;
	teamBId: string;
	discipline: RankingTiebreakerDiscipline;
	playerA1Id: string;
	playerA2Id: string;
	playerB1Id: string;
	playerB2Id: string;
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

	const [teamA, teamB, playerA1, playerA2, playerB1, playerB2] = await Promise.all([
		db.query.teams.findFirst({ where: eq(teams.id, params.teamAId) }),
		db.query.teams.findFirst({ where: eq(teams.id, params.teamBId) }),
		db.query.teamPlayers.findFirst({ where: eq(teamPlayers.id, params.playerA1Id) }),
		db.query.teamPlayers.findFirst({ where: eq(teamPlayers.id, params.playerA2Id) }),
		db.query.teamPlayers.findFirst({ where: eq(teamPlayers.id, params.playerB1Id) }),
		db.query.teamPlayers.findFirst({ where: eq(teamPlayers.id, params.playerB2Id) })
	]);
	const validated = validateRankingTiebreakerSelection({
		teamA,
		teamB,
		discipline: params.discipline,
		playersA: [playerA1, playerA2],
		playersB: [playerB1, playerB2]
	});

	await ensureInternalTournament(now);
	const rankingTiebreakerId = crypto.randomUUID();
	const matchId = crypto.randomUUID();

	// rankingTiebreakers.matchId and matches.rankingTiebreakerId form a circular FK, so the
	// rankingTiebreakers row must exist (with matchId null) before the matches insert can
	// reference it, and can only be backfilled with matchId after the matches row exists.
	await db.insert(rankingTiebreakers).values({
		id: rankingTiebreakerId,
		groupCode: params.groupCode,
		reason: params.reason,
		teamAId: validated.teamA.id,
		teamBId: validated.teamB.id,
		matchId: null,
		status: 'scheduled',
		createdAt: now,
		updatedAt: now
	});

	const { statements } = buildCreateMatchWithPlayersStatementsForId(
		db,
		{
			tournamentId: INTERNAL_TOURNAMENT_ID,
			courtId: null,
			discipline: params.discipline,
			eventName: `${params.groupCode}リーグ順位決定再試合`,
			category: params.reason,
			roundName: `${validated.teamA.name} vs ${validated.teamB.name}`,
			rankingTiebreakerId,
			scoringRuleId: scoringRule.id,
			scoring: scoringConfigFromRule(scoringRule),
			players: [
				{ side: 'A', order: 1, name: validated.playersA[0].name, teamName: validated.teamA.name },
				{ side: 'A', order: 2, name: validated.playersA[1].name, teamName: validated.teamA.name },
				{ side: 'B', order: 1, name: validated.playersB[0].name, teamName: validated.teamB.name },
				{ side: 'B', order: 2, name: validated.playersB[1].name, teamName: validated.teamB.name }
			],
			now
		},
		matchId
	);

	await db.batch([
		...statements,
		db
			.update(rankingTiebreakers)
			.set({ matchId, updatedAt: now })
			.where(eq(rankingTiebreakers.id, rankingTiebreakerId))
	] as unknown as Parameters<typeof db.batch>[0]);
	return { rankingTiebreakerId, matchId };
}

export async function syncRankingTiebreakerResult(matchId: string, now = new Date().toISOString()) {
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
