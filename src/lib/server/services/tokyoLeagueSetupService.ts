import { eq } from 'drizzle-orm';
import type { ScoringConfig } from '$lib/domain/types';
import { TOKYO_LEAGUE_SCORING_RULES } from '$lib/domain/tokyoLeague';
import { getRequestDb } from '$lib/server/db/request';
import { appSettings, scoringRules, tournaments } from '$lib/server/db/schema';

async function ensureDefaultScoringRules(now = new Date().toISOString()) {
	const db = getRequestDb();
	for (const rule of TOKYO_LEAGUE_SCORING_RULES) {
		const existing = await db.query.scoringRules.findFirst({
			where: eq(scoringRules.code, rule.code)
		});
		if (existing) continue;

		await db.insert(scoringRules).values({
			id: rule.code,
			code: rule.code,
			name: rule.name,
			maxGames: rule.maxGames,
			gamesToWin: rule.gamesToWin,
			pointsToWin: rule.pointsToWin,
			winBy: rule.winBy,
			maxPoints: rule.maxPoints,
			midGameIntervalPoint: rule.midGameIntervalPoint,
			createdAt: now,
			updatedAt: now
		});
	}
}

export async function ensureDefaultSettings(now = new Date().toISOString()) {
	const db = getRequestDb();
	await ensureDefaultScoringRules(now);

	const existing = await db.query.appSettings.findFirst({
		where: eq(appSettings.id, 'default')
	});
	if (existing) return existing;

	const values = {
		id: 'default',
		eventName: '東大リーグ団体戦',
		groupStageScoringRuleId: 'GROUP_15',
		knockoutScoringRuleId: 'KNOCKOUT_21',
		tiebreakerScoringRuleId: 'TIEBREAKER_21_SINGLE_GAME',
		lineupRevealPolicy: 'on_tie_start' as const,
		defaultLineupDueMinutesBefore: 10,
		createdAt: now,
		updatedAt: now
	};

	await db.insert(appSettings).values(values);
	return values;
}

export const INTERNAL_TOURNAMENT_ID = 'tokyo-league-default';

export function scoringConfigFromRule(rule: typeof scoringRules.$inferSelect): ScoringConfig {
	return {
		maxGames: rule.maxGames,
		gamesToWin: rule.gamesToWin,
		pointsToWin: rule.pointsToWin,
		winBy: rule.winBy,
		maxPoints: rule.maxPoints,
		midGameIntervalPoint: rule.midGameIntervalPoint
	};
}

export async function ensureInternalTournament(now: string) {
	const db = getRequestDb();
	const existing = await db.query.tournaments.findFirst({
		where: eq(tournaments.id, INTERNAL_TOURNAMENT_ID)
	});
	if (existing) return;
	await db.insert(tournaments).values({
		id: INTERNAL_TOURNAMENT_ID,
		name: '東大リーグ団体戦',
		status: 'running',
		createdAt: now,
		updatedAt: now
	});
}
