import { now as nowIso } from '$lib/utils/now';
import { eq, inArray } from 'drizzle-orm';
import type { ScoringConfig } from '$lib/domain/types';
import { TOKYO_LEAGUE_SCORING_RULES } from '$lib/domain/tokyoLeague';
import { getRequestDb } from '$lib/server/db/request';
import { appSettings, scoringRules, tournaments } from '$lib/server/db/schema';

async function ensureDefaultScoringRules(now = nowIso()) {
	const db = getRequestDb();
	const codes = TOKYO_LEAGUE_SCORING_RULES.map((r) => r.code);
	const existing = await db
		.select({ code: scoringRules.code })
		.from(scoringRules)
		.where(inArray(scoringRules.code, codes));
	const existingCodes = new Set(existing.map((r) => r.code));
	const missing = TOKYO_LEAGUE_SCORING_RULES.filter((r) => !existingCodes.has(r.code));
	for (const rule of missing) {
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

export async function ensureDefaultSettings(now = nowIso()) {
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
		tournamentDate: null,
		createdAt: now,
		updatedAt: now
	};

	await db.insert(appSettings).values(values);
	return values;
}

type AppSettings = Awaited<ReturnType<typeof ensureDefaultSettings>>;

// 設定ページの値は運営が随時変更するものではないため、isolate 単位でメモリキャッシュする。
// 更新時は invalidateAppSettingsCache() で即時に破棄され、同一 isolate では次回アクセスで
// 再取得される(他 isolate へは TTL 経過で伝播)。ページロードのたびに D1 へ読みに行かないための最適化であり、
// 生成・変更系の内部処理では ensureDefaultSettings() をそのまま使い、常に最新値を読む。
const APP_SETTINGS_CACHE_TTL_MS = 60_000;
let cachedAppSettings: { value: AppSettings; expiresAt: number } | null = null;

/** ページロード用のキャッシュ付き設定取得。書き込み系の処理では使わないこと。 */
export async function getCachedAppSettings(now = nowIso()): Promise<AppSettings> {
	if (cachedAppSettings && cachedAppSettings.expiresAt > Date.now()) {
		return cachedAppSettings.value;
	}
	const settings = await ensureDefaultSettings(now);
	cachedAppSettings = { value: settings, expiresAt: Date.now() + APP_SETTINGS_CACHE_TTL_MS };
	return settings;
}

/** 設定保存後に呼び、このisolateのキャッシュを即時破棄する。 */
export function invalidateAppSettingsCache() {
	cachedAppSettings = null;
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

let tournamentEnsured = false;

/** Reset the module-level cache (for test isolation). */
export function resetTournamentEnsured() {
	tournamentEnsured = false;
}

export async function ensureInternalTournament(now: string) {
	if (tournamentEnsured) return;
	const db = getRequestDb();
	const existing = await db.query.tournaments.findFirst({
		where: eq(tournaments.id, INTERNAL_TOURNAMENT_ID)
	});
	if (existing) {
		tournamentEnsured = true;
		return;
	}
	await db.insert(tournaments).values({
		id: INTERNAL_TOURNAMENT_ID,
		name: '東大リーグ団体戦',
		status: 'running',
		createdAt: now,
		updatedAt: now
	});
	tournamentEnsured = true;
}
