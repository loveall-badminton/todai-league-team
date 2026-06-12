import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/auth/access';
import { getRequestDb } from '$lib/server/db/request';
import {
	getTeamWithPlayers,
	listRankingTiebreakers,
	listGroupTies,
	listScoringRules,
	listTeams,
	listTeamsByGroup
} from '$lib/server/repositories/tokyoLeagueRepository';
import { calculateGroupStandings } from '$lib/server/services/standingService';
import { ensureDefaultSettings } from '$lib/server/services/tokyoLeagueSetupService';

function parseGroupCode(value: string): 'A' | 'B' {
	if (value === 'A' || value === 'B') return value;
	error(404, 'Group not found');
}

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const { params, platform } = event;
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
