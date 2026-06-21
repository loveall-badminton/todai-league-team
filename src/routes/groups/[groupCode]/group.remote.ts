import { command, form, getRequestEvent, query } from '$app/server';
import { groupPhaseFor } from '$lib/domain/tokyoLeague';
import { requireAdmin } from '$lib/server/auth/access';
import { notifyLiveBoard } from '$lib/server/realtime/broadcast';
import { emptyToNull } from '$lib/utils/validation';
import {
	getTeamWithPlayers,
	listGroupTies,
	listRankingTiebreakers,
	listScoringRules,
	listTeams,
	listTeamsByGroup,
	reorderTies,
	setGroupStandingOverride
} from '$lib/server/repositories/tokyoLeagueRepository';
import { calculateGroupStandings } from '$lib/server/services/standingService';
import { ensureDefaultSettings } from '$lib/server/services/tokyoLeagueSetupService';
import {
	createRankingTiebreaker,
	syncRankingTiebreakerResult
} from '$lib/server/services/rankingTiebreakerService';
import { generateGroupRoundRobinTies } from '$lib/server/services/tieService';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { createTiebreakerSchema, setManualRankSchema } from './group.schema';

function parseGroupCode(value: string): 'A' | 'B' {
	if (value === 'A' || value === 'B') return value;
	error(404, 'Group not found');
}

export const getGroupRealtimeData = query(v.string(), async (groupCodeValue) => {
	requireAdmin();
	const groupCode = parseGroupCode(groupCodeValue);

	const [ties, standings, rankingTiebreakers] = await Promise.all([
		listGroupTies(groupCode),
		calculateGroupStandings(groupCode),
		listRankingTiebreakers(groupCode)
	]);

	return { ties, standings, rankingTiebreakers };
});

export const getGroupPageData = query(v.string(), async (groupCodeValue) => {
	requireAdmin();
	const groupCode = parseGroupCode(groupCodeValue);
	const settings = await ensureDefaultSettings();
	const [groupTeams, allTeams, scoringRules] = await Promise.all([
		listTeamsByGroup(groupCode),
		listTeams(),
		listScoringRules()
	]);
	const groupTeamPlayers = await Promise.all(
		groupTeams.map(async (team) => ({
			teamId: team.id,
			players: (await getTeamWithPlayers(team.id))?.players ?? []
		}))
	);

	return {
		groupCode,
		groupTeams,
		groupTeamPlayers,
		allTeams,
		scoringRules,
		settings
	};
});

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
	notifyLiveBoard(['standings', 'schedule'], {
		standings: { groupCodes: [groupCode] },
		schedule: { phases: [groupPhaseFor(groupCode)] }
	});
	return { message: `${created}件の対戦を生成しました` };
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
	notifyLiveBoard(['standings'], { standings: { groupCodes: [groupCode] } });
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
		notifyLiveBoard(['standings', 'schedule'], {
			standings: { groupCodes: [groupCode] },
			schedule: { phases: ['ranking_tiebreaker'] }
		});
		return { message: `順位決定再試合を作成しました: ${result.matchId}` };
	}
);

export const syncTiebreaker = command(v.object({ matchId: v.string() }), async ({ matchId }) => {
	const event = getRequestEvent();
	requireAdmin();
	const groupCode = parseGroupCode(event.params.groupCode!);
	await syncRankingTiebreakerResult(matchId, new Date().toISOString());
	notifyLiveBoard(['standings', 'score'], { standings: { groupCodes: [groupCode] } });
});

export const reorder = command(v.object({ ids: v.array(v.string()) }), async ({ ids }) => {
	const event = getRequestEvent();
	requireAdmin();
	const groupCode = parseGroupCode(event.params.groupCode!);
	await reorderTies(ids, new Date().toISOString());
	notifyLiveBoard(['schedule'], {
		schedule: { tieIds: ids, phases: [groupPhaseFor(groupCode)] }
	});
});
