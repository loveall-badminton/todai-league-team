import { fail } from '@sveltejs/kit';
import { getRequestDb } from '$lib/server/db/request';
import { listTies } from '$lib/server/repositories/tokyoLeagueRepository';
import {
	generateFinalAndThirdPlace,
	generateSemifinalsAndFifthPlace
} from '$lib/server/services/finalsService';
import type { Actions, PageServerLoad } from './$types';

const finalPhases = ['semifinal', 'fifth_place', 'third_place', 'final'];

export const load: PageServerLoad = async ({ platform }) => {
	const db = getRequestDb(platform);
	const ties = (await listTies(db)).filter((tie) => finalPhases.includes(tie.phase));
	return { ties };
};

export const actions: Actions = {
	generateSemifinals: async ({ platform }) => {
		try {
			const changed = await generateSemifinalsAndFifthPlace(
				getRequestDb(platform),
				new Date().toISOString()
			);
			return { message: `${changed}件の決勝トーナメント対戦を生成しました。` };
		} catch (error) {
			return fail(400, {
				message: error instanceof Error ? error.message : '決勝トーナメント対戦の生成に失敗しました。'
			});
		}
	},
	generateFinals: async ({ platform }) => {
		try {
			const changed = await generateFinalAndThirdPlace(
				getRequestDb(platform),
				new Date().toISOString()
			);
			return { message: `${changed}件の決勝・3位決定戦を生成しました。` };
		} catch (error) {
			return fail(400, {
				message: error instanceof Error ? error.message : '決勝・3位決定戦の生成に失敗しました。'
			});
		}
	}
};
