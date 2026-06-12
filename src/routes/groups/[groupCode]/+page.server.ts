import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getRequestDb } from '$lib/server/db/request';
import {
	assignOfficiatingTeam,
	getTeamWithPlayers,
	listRankingTiebreakers,
	listGroupTies,
	listScoringRules,
	listTeams,
	listTeamsByGroup,
	reorderTies,
	setGroupStandingOverride,
	updateTieSchedule
} from '$lib/server/repositories/tokyoLeagueRepository';
import {
	createRankingTiebreaker,
	syncRankingTiebreakerResult
} from '$lib/server/services/rankingTiebreakerService';
import { calculateGroupStandings } from '$lib/server/services/standingService';
import { generateGroupRoundRobinTies } from '$lib/server/services/tieService';
import { ensureDefaultSettings } from '$lib/server/services/tokyoLeagueSetupService';

export const load: PageServerLoad = async ({ params, platform }) => {
	const groupCode = parseGroupCode(params.groupCode);
	const db = getRequestDb(platform);
	const settings = await ensureDefaultSettings(db);
	const [groupTeams, ties, allTeams, scoringRules, standings, rankingTiebreakers] =
		await Promise.all([
			listTeamsByGroup(db, groupCode),
			listGroupTies(db, groupCode),
			listTeams(db),
			listScoringRules(db),
			calculateGroupStandings(db, groupCode),
			listRankingTiebreakers(db, groupCode)
		]);
	const groupTeamPlayers = await Promise.all(
		groupTeams.map(async (team) => ({
			teamId: team.id,
			players: (await getTeamWithPlayers(db, team.id))?.players ?? []
		}))
	);
	return {
		groupCode,
		groupTeams,
		groupTeamPlayers,
		ties,
		allTeams,
		scoringRules,
		settings,
		standings,
		rankingTiebreakers
	};
};

export const actions: Actions = {
	generateRoundRobin: async ({ params, platform }) => {
		const groupCode = parseGroupCode(params.groupCode);
		const db = getRequestDb(platform);
		const settings = await ensureDefaultSettings(db);
		const scoringRuleId = settings.groupStageScoringRuleId;
		if (!scoringRuleId) return fail(400, { message: '予選用得点ルールが未設定です' });

		const created = await generateGroupRoundRobinTies(db, {
			groupCode,
			tieCodePrefix: groupCode,
			scoringRuleId,
			now: new Date().toISOString()
		});
		return { message: `${created}件の対戦を生成しました` };
	},
	updateTie: async ({ request, platform }) => {
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '');
		const tieCode = String(formData.get('tieCode') ?? '').trim();
		if (!id || !tieCode) return fail(400, { message: 'tieCodeは必須です' });

		const db = getRequestDb(platform);
		await updateTieSchedule(db, {
			id,
			tieCode,
			scheduledStartAt: emptyToNull(formData.get('scheduledStartAt')),
			venue: venueOrNull(formData.get('venue')),
			courtBlockCode: emptyToNull(formData.get('courtBlockCode')),
			lineupDueAt: emptyToNull(formData.get('lineupDueAt')),
			operationNote: emptyToNull(formData.get('operationNote')),
			scheduleChanged: formData.get('scheduleChanged') === 'on',
			now: new Date().toISOString()
		});

		await assignOfficiatingTeam(db, {
			tieId: id,
			assignedTeamId: emptyToNull(formData.get('assignedTeamId')),
			note: emptyToNull(formData.get('officiatingNote')),
			now: new Date().toISOString()
		});

		return { message: '対戦情報を更新しました' };
	},
	setManualRank: async ({ request, params, platform }) => {
		const groupCode = parseGroupCode(params.groupCode);
		const formData = await request.formData();
		const teamId = String(formData.get('teamId') ?? '').trim();
		const manualRank = Number(formData.get('manualRank'));
		if (!teamId || !Number.isInteger(manualRank) || manualRank < 1) {
			return fail(400, { message: '手動順位が不正です' });
		}

		await setGroupStandingOverride(getRequestDb(platform), {
			groupCode,
			teamId,
			manualRank,
			reason: emptyToNull(formData.get('reason')),
			now: new Date().toISOString()
		});
		return { message: '手動順位を保存しました' };
	},
	createTiebreaker: async ({ request, params, platform }) => {
		const groupCode = parseGroupCode(params.groupCode);
		const formData = await request.formData();
		const teamAId = String(formData.get('teamAId') ?? '').trim();
		const teamBId = String(formData.get('teamBId') ?? '').trim();
		const playerAId = String(formData.get('playerAId') ?? '').trim();
		const playerBId = String(formData.get('playerBId') ?? '').trim();
		const reason = String(formData.get('reason') ?? '').trim();
		if (!teamAId || !teamBId || teamAId === teamBId || !playerAId || !playerBId || !reason) {
			return fail(400, { message: '再試合の入力が不正です' });
		}

		const result = await createRankingTiebreaker(getRequestDb(platform), {
			groupCode,
			teamAId,
			teamBId,
			playerAId,
			playerBId,
			reason,
			now: new Date().toISOString()
		});
		return { message: `順位決定再試合を作成しました: ${result.matchId}` };
	},
	syncTiebreaker: async ({ request, platform }) => {
		const formData = await request.formData();
		const matchId = String(formData.get('matchId') ?? '').trim();
		if (!matchId) return fail(400, { message: 'matchが不正です' });
		await syncRankingTiebreakerResult(getRequestDb(platform), matchId, new Date().toISOString());
		return { message: '順位決定再試合の結果を同期しました' };
	},
	reorder: async ({ request, platform }) => {
		const formData = await request.formData();
		const raw = String(formData.get('ids') ?? '[]');
		const ids = JSON.parse(raw);
		if (!Array.isArray(ids)) return fail(400, { message: '不正なリクエスト' });
		await reorderTies(getRequestDb(platform), ids, new Date().toISOString());
		return { message: '' };
	}
};

function parseGroupCode(value: string): 'A' | 'B' {
	if (value === 'A' || value === 'B') return value;
	error(404, 'Group not found');
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
	const text = String(value ?? '').trim();
	return text === '' ? null : text;
}

function venueOrNull(value: FormDataEntryValue | null): 'first_gym' | 'second_gym' | null {
	const text = String(value ?? '');
	if (text === 'first_gym' || text === 'second_gym') return text;
	return null;
}
