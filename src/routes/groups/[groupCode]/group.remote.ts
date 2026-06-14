import { command, form, getRequestEvent } from '$app/server';
import { requireAdmin } from '$lib/server/auth/access';
import {
	assignOfficiatingTeam,
	reorderTies,
	setGroupStandingOverride,
	updateTieSchedule
} from '$lib/server/repositories/tokyoLeagueRepository';
import {
	createRankingTiebreaker,
	syncRankingTiebreakerResult
} from '$lib/server/services/rankingTiebreakerService';
import { generateGroupRoundRobinTies } from '$lib/server/services/tieService';
import { ensureDefaultSettings } from '$lib/server/services/tokyoLeagueSetupService';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

function parseGroupCode(value: string): 'A' | 'B' {
	if (value === 'A' || value === 'B') return value;
	error(404, 'Group not found');
}

const emptyToNull = (s: string | undefined | null): string | null => {
	const text = (s ?? '').trim();
	return text === '' ? null : text;
};

const venueOrNull = (s: string | undefined | null): 'first_gym' | 'second_gym' | null => {
	if (s === 'first_gym' || s === 'second_gym') return s;
	return null;
};

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
	return { message: `${created}件の対戦を生成しました` };
});

export const updateTie = form(
	v.object({
		id: v.pipe(v.string(), v.trim(), v.minLength(1)),
		tieCode: v.pipe(v.string(), v.trim(), v.minLength(1)),
		scheduledStartAt: v.optional(v.string()),
		venue: v.optional(v.string()),
		courtBlockCode: v.optional(v.string()),
		lineupDueAt: v.optional(v.string()),
		operationNote: v.optional(v.string()),
		scheduleChanged: v.optional(v.string()),
		assignedTeamId: v.optional(v.string()),
		officiatingNote: v.optional(v.string())
	}),
	async ({
		id,
		tieCode,
		scheduledStartAt,
		venue,
		courtBlockCode,
		lineupDueAt,
		operationNote,
		scheduleChanged,
		assignedTeamId,
		officiatingNote
	}) => {
		requireAdmin();
		const now = new Date().toISOString();

		await updateTieSchedule({
			id,
			tieCode,
			scheduledStartAt: emptyToNull(scheduledStartAt),
			venue: venueOrNull(venue),
			courtBlockCode: emptyToNull(courtBlockCode),
			lineupDueAt: emptyToNull(lineupDueAt),
			operationNote: emptyToNull(operationNote),
			scheduleChanged: scheduleChanged === 'on',
			now
		});

		await assignOfficiatingTeam({
			tieId: id,
			assignedTeamId: emptyToNull(assignedTeamId),
			note: emptyToNull(officiatingNote),
			now
		});

		return { message: '対戦情報を更新しました' };
	}
);

export const setManualRank = form(
	v.object({
		teamId: v.pipe(v.string(), v.trim(), v.minLength(1)),
		manualRank: v.pipe(v.string(), v.transform(Number), v.number(), v.integer(), v.minValue(1)),
		reason: v.optional(v.string())
	}),
	async ({ teamId, manualRank, reason }) => {
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
		return { message: '手動順位を保存しました' };
	}
);

export const createTiebreaker = form(
	v.object({
		teamAId: v.pipe(v.string(), v.trim(), v.minLength(1)),
		teamBId: v.pipe(v.string(), v.trim(), v.minLength(1)),
		playerAId: v.pipe(v.string(), v.trim(), v.minLength(1)),
		playerBId: v.pipe(v.string(), v.trim(), v.minLength(1)),
		reason: v.pipe(v.string(), v.trim(), v.minLength(1))
	}),
	async ({ teamAId, teamBId, playerAId, playerBId, reason }) => {
		const event = getRequestEvent();
		requireAdmin();
		const groupCode = parseGroupCode(event.params.groupCode!);
		const result = await createRankingTiebreaker({
			groupCode,
			teamAId,
			teamBId,
			playerAId,
			playerBId,
			reason,
			now: new Date().toISOString()
		});
		return { message: `順位決定再試合を作成しました: ${result.matchId}` };
	}
);

export const syncTiebreaker = command(v.object({ matchId: v.string() }), async ({ matchId }) => {
	requireAdmin();
	await syncRankingTiebreakerResult(matchId, new Date().toISOString());
});

export const reorder = command(v.object({ ids: v.array(v.string()) }), async ({ ids }) => {
	requireAdmin();
	await reorderTies(ids, new Date().toISOString());
});
