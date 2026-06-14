import { requireAdmin } from '$lib/server/auth/access';
import {
	getTeamWithPlayers,
	listGroupTies,
	listRankingTiebreakers,
	listScoringRules,
	listTeams,
	listTeamsByGroup
} from '$lib/server/repositories/tokyoLeagueRepository';
import { calculateGroupStandings } from '$lib/server/services/standingService';
import { ensureDefaultSettings } from '$lib/server/services/tokyoLeagueSetupService';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

function parseGroupCode(value: string): 'A' | 'B' {
	if (value === 'A' || value === 'B') return value;
	error(404, 'Group not found');
}

export const load: PageServerLoad = async (event) => {
	requireAdmin();
	const { params } = event;
	const groupCode = parseGroupCode(params.groupCode);
	const settings = await ensureDefaultSettings();
	const [groupTeams, ties, allTeams, scoringRules, standings, rankingTiebreakers] =
		await Promise.all([
			listTeamsByGroup(groupCode),
			listGroupTies(groupCode),
			listTeams(),
			listScoringRules(),
			calculateGroupStandings(groupCode),
			listRankingTiebreakers(groupCode)
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
		ties,
		allTeams,
		scoringRules,
		settings,
		standings,
		rankingTiebreakers
	};
};
