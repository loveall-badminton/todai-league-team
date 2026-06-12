import { fail } from '@sveltejs/kit';
import { getRequestDb } from '$lib/server/db/request';
import {
	getLeagueSettings,
	listScoringRules,
	updateLeagueSettings,
	updateScoringRule
} from '$lib/server/repositories/tokyoLeagueRepository';
import type { Actions, PageServerLoad } from './$types';

const readRequiredText = (formData: FormData, key: string) => {
	const value = String(formData.get(key) ?? '').trim();
	if (!value) throw new Error(`${key} is required`);
	return value;
};

const readOptionalText = (formData: FormData, key: string) => {
	const value = String(formData.get(key) ?? '').trim();
	return value || null;
};

const readNumber = (formData: FormData, key: string) => {
	const value = Number(formData.get(key));
	if (!Number.isInteger(value) || value < 0)
		throw new Error(`${key} must be a non-negative integer`);
	return value;
};

const readPositiveNumber = (formData: FormData, key: string) => {
	const value = readNumber(formData, key);
	if (value < 1) throw new Error(`${key} must be a positive integer`);
	return value;
};

export const load: PageServerLoad = async ({ platform }) => {
	const db = getRequestDb(platform);
	const [settings, scoringRules] = await Promise.all([getLeagueSettings(db), listScoringRules(db)]);
	return { settings, scoringRules };
};

export const actions: Actions = {
	updateSettings: async ({ request, platform }) => {
		const db = getRequestDb(platform);
		const formData = await request.formData();
		const now = new Date().toISOString();

		try {
			const lineupRevealPolicy = readRequiredText(formData, 'lineupRevealPolicy');
			if (lineupRevealPolicy !== 'on_tie_start' && lineupRevealPolicy !== 'manual') {
				return fail(400, { message: 'オーダー公開方針が不正です。' });
			}

			await updateLeagueSettings(db, {
				eventName: readRequiredText(formData, 'eventName'),
				groupStageScoringRuleId: readOptionalText(formData, 'groupStageScoringRuleId'),
				knockoutScoringRuleId: readOptionalText(formData, 'knockoutScoringRuleId'),
				tiebreakerScoringRuleId: readOptionalText(formData, 'tiebreakerScoringRuleId'),
				lineupRevealPolicy,
				defaultLineupDueMinutesBefore: readNumber(formData, 'defaultLineupDueMinutesBefore'),
				now
			});
			return { message: '設定を保存しました。' };
		} catch (error) {
			return fail(400, {
				message: error instanceof Error ? error.message : '設定の保存に失敗しました。'
			});
		}
	},
	updateScoringRule: async ({ request, platform }) => {
		const db = getRequestDb(platform);
		const formData = await request.formData();
		const now = new Date().toISOString();

		try {
			const pointsToWin = readPositiveNumber(formData, 'pointsToWin');
			const maxPoints = readPositiveNumber(formData, 'maxPoints');
			const gamesToWin = readPositiveNumber(formData, 'gamesToWin');
			const maxGames = readPositiveNumber(formData, 'maxGames');

			if (pointsToWin > maxPoints) {
				return fail(400, { message: '勝利点は上限点以下にしてください。' });
			}
			if (gamesToWin > maxGames) {
				return fail(400, { message: '必要ゲーム数は最大ゲーム数以下にしてください。' });
			}

			await updateScoringRule(db, {
				id: readRequiredText(formData, 'id'),
				name: readRequiredText(formData, 'name'),
				maxGames,
				gamesToWin,
				pointsToWin,
				winBy: readPositiveNumber(formData, 'winBy'),
				maxPoints,
				midGameIntervalPoint: readPositiveNumber(formData, 'midGameIntervalPoint'),
				now
			});
			return { message: '得点ルールを保存しました。' };
		} catch (error) {
			return fail(400, {
				message: error instanceof Error ? error.message : '得点ルールの保存に失敗しました。'
			});
		}
	}
};
