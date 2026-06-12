import { form, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { requireAdmin } from '$lib/server/auth/access';
import { getRequestDb } from '$lib/server/db/request';
import {
	updateLeagueSettings,
	updateScoringRule as updateScoringRuleRepo
} from '$lib/server/repositories/tokyoLeagueRepository';

const intPositive = v.pipe(v.string(), v.transform(Number), v.number(), v.integer(), v.minValue(1));
const intNonNeg = v.pipe(v.string(), v.transform(Number), v.number(), v.integer(), v.minValue(0));

function emptyToNull(s: string): string | null {
	return s.trim() === '' ? null : s.trim();
}

export const updateSettings = form(
	v.object({
		eventName: v.pipe(v.string(), v.trim(), v.minLength(1, '大会名は必須です')),
		groupStageScoringRuleId: v.string(),
		knockoutScoringRuleId: v.string(),
		tiebreakerScoringRuleId: v.string(),
		lineupRevealPolicy: v.picklist(['on_tie_start', 'manual'] as const),
		defaultLineupDueMinutesBefore: intNonNeg
	}),
	async ({
		eventName,
		groupStageScoringRuleId,
		knockoutScoringRuleId,
		tiebreakerScoringRuleId,
		lineupRevealPolicy,
		defaultLineupDueMinutesBefore
	}) => {
		const event = getRequestEvent();
		requireAdmin(event);
		const db = getRequestDb(event.platform);
		try {
			await updateLeagueSettings(db, {
				eventName,
				groupStageScoringRuleId: emptyToNull(groupStageScoringRuleId),
				knockoutScoringRuleId: emptyToNull(knockoutScoringRuleId),
				tiebreakerScoringRuleId: emptyToNull(tiebreakerScoringRuleId),
				lineupRevealPolicy,
				defaultLineupDueMinutesBefore,
				now: new Date().toISOString()
			});
			return { message: '設定を保存しました。' };
		} catch (err) {
			error(400, err instanceof Error ? err.message : '保存に失敗しました');
		}
	}
);

export const updateScoringRule = form(
	v.object({
		id: v.string(),
		name: v.pipe(v.string(), v.trim(), v.minLength(1)),
		maxGames: intPositive,
		gamesToWin: intPositive,
		pointsToWin: intPositive,
		winBy: intPositive,
		maxPoints: intPositive,
		midGameIntervalPoint: intPositive
	}),
	async ({
		id,
		name,
		maxGames,
		gamesToWin,
		pointsToWin,
		winBy,
		maxPoints,
		midGameIntervalPoint
	}) => {
		const event = getRequestEvent();
		requireAdmin(event);
		if (pointsToWin > maxPoints) error(400, '勝利点は上限点以下にしてください。');
		if (gamesToWin > maxGames) error(400, '必要ゲーム数は最大ゲーム数以下にしてください。');
		const db = getRequestDb(event.platform);
		try {
			await updateScoringRuleRepo(db, {
				id,
				name,
				maxGames,
				gamesToWin,
				pointsToWin,
				winBy,
				maxPoints,
				midGameIntervalPoint,
				now: new Date().toISOString()
			});
			return { message: '得点ルールを保存しました。' };
		} catch (err) {
			error(400, err instanceof Error ? err.message : '保存に失敗しました');
		}
	}
);
