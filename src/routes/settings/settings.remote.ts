import { form } from '$app/server';
import { requireAdmin } from '$lib/server/auth/access';
import {
	updateLeagueSettings,
	updateScoringRule as updateScoringRuleRepo
} from '$lib/server/repositories/tokyoLeagueRepository';
import { emptyToNull } from '$lib/utils/validation';
import { error } from '@sveltejs/kit';
import { updateScoringRuleSchema, updateSettingsSchema } from './settings.schema';

export const updateSettings = form(
	updateSettingsSchema,
	async ({
		eventName,
		groupStageScoringRuleId,
		knockoutScoringRuleId,
		tiebreakerScoringRuleId,
		lineupRevealPolicy,
		defaultLineupDueMinutesBefore
	}) => {
		requireAdmin();
		try {
			await updateLeagueSettings({
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
	updateScoringRuleSchema,
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
		requireAdmin();
		if (pointsToWin > maxPoints) error(400, '勝利点は上限点以下にしてください。');
		if (gamesToWin > maxGames) error(400, '必要ゲーム数は最大ゲーム数以下にしてください。');
		try {
			await updateScoringRuleRepo({
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
