import { command, form, getRequestEvent } from '$app/server';
import { requireAdmin } from '$lib/server/auth/access';
import { notifyLiveBoard } from '$lib/server/realtime/broadcast';
import { emptyToNull } from '$lib/utils/validation';
import {
	reorderTies,
	setGroupStandingOverride
} from '$lib/server/repositories/tokyoLeagueRepository';
import { persistUpdateTie } from '$lib/server/services/updateTieForm';
import {
	createRankingTiebreaker,
	syncRankingTiebreakerResult
} from '$lib/server/services/rankingTiebreakerService';
import { generateGroupRoundRobinTies } from '$lib/server/services/tieService';
import { ensureDefaultSettings } from '$lib/server/services/tokyoLeagueSetupService';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { createTiebreakerSchema, setManualRankSchema, updateTieSchema } from './group.schema';

function parseGroupCode(value: string): 'A' | 'B' {
	if (value === 'A' || value === 'B') return value;
	error(404, 'Group not found');
}

export const generateRoundRobin = command(async () => {
	const event = getRequestEvent();
	requireAdmin();
	const groupCode = parseGroupCode(event.params.groupCode!);
	const settings = await ensureDefaultSettings();
	const scoringRuleId = settings.groupStageScoringRuleId;
	if (!scoringRuleId) error(400, '予選用得点ルールが未設定です');

	const created = await generateGroupRoundRobinTies({
		groupCode,
		tieCodePrefix: groupCode,
		scoringRuleId,
		now: new Date().toISOString()
	});
	notifyLiveBoard(['standings', 'schedule']);
	return { message: `${created}件の対戦を生成しました` };
});

export const updateTie = form(updateTieSchema, async (values) => {
	requireAdmin();
	await persistUpdateTie({ ...values, now: new Date().toISOString() });
	return { message: '対戦情報を更新しました' };
});

export const setManualRank = form(setManualRankSchema, async ({ teamId, manualRank, reason }) => {
	const event = getRequestEvent();
	requireAdmin();
	const groupCode = parseGroupCode(event.params.groupCode!);
	await setGroupStandingOverride({
		groupCode,
		teamId,
		manualRank,
		reason: emptyToNull(reason),
		now: new Date().toISOString()
	});
	notifyLiveBoard(['standings']);
	return { message: '手動順位を保存しました' };
});

export const createTiebreaker = form(
	createTiebreakerSchema,
	async ({
		teamAId,
		teamBId,
		discipline,
		playerA1Id,
		playerA2Id,
		playerB1Id,
		playerB2Id,
		reason
	}) => {
		const event = getRequestEvent();
		requireAdmin();
		const groupCode = parseGroupCode(event.params.groupCode!);
		const result = await createRankingTiebreaker({
			groupCode,
			teamAId,
			teamBId,
			discipline,
			playerA1Id,
			playerA2Id,
			playerB1Id,
			playerB2Id,
			reason,
			now: new Date().toISOString()
		});
		notifyLiveBoard(['standings', 'schedule']);
		return { message: `順位決定再試合を作成しました: ${result.matchId}` };
	}
);

export const syncTiebreaker = command(v.object({ matchId: v.string() }), async ({ matchId }) => {
	requireAdmin();
	await syncRankingTiebreakerResult(matchId, new Date().toISOString());
	notifyLiveBoard(['standings', 'score']);
});

export const reorder = command(v.object({ ids: v.array(v.string()) }), async ({ ids }) => {
	requireAdmin();
	await reorderTies(ids, new Date().toISOString());
	notifyLiveBoard(['schedule']);
});
