import { command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth/access';
import { getRequestDb } from '$lib/server/db/request';
import {
	generateFinalAndThirdPlace,
	generateSemifinalsAndFifthPlace
} from '$lib/server/services/finalsService';

export const generateSemifinals = command(async () => {
	const event = getRequestEvent();
	requireAdmin(event);
	try {
		const changed = await generateSemifinalsAndFifthPlace(
			getRequestDb(event.platform),
			new Date().toISOString()
		);
		return { message: `${changed}件の決勝トーナメント対戦を生成しました。` };
	} catch (err) {
		error(400, err instanceof Error ? err.message : '生成に失敗しました');
	}
});

export const generateFinals = command(async () => {
	const event = getRequestEvent();
	requireAdmin(event);
	try {
		const changed = await generateFinalAndThirdPlace(
			getRequestDb(event.platform),
			new Date().toISOString()
		);
		return { message: `${changed}件の決勝・3位決定戦を生成しました。` };
	} catch (err) {
		error(400, err instanceof Error ? err.message : '生成に失敗しました');
	}
});
