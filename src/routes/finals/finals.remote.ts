import { command, query } from '$app/server';
import { requireAdmin } from '$lib/server/auth/access';
import { notifyLiveBoard } from '$lib/server/realtime/broadcast';
import { listTeams, listTies } from '$lib/server/repositories/tokyoLeagueRepository';
import {
	buildSemifinalsAndFifthPlaceSuggestions,
	generateFifthPlace as generateFifthPlaceService,
	generateFinalAndThirdPlace,
	generateSemifinals as generateSemifinalsService
} from '$lib/server/services/finalsService';
import { calculateGroupStandings } from '$lib/server/services/standingService';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

const finalPhases = ['semifinal', 'fifth_place', 'third_place', 'final'] as const;

const semifinalSelectionSchema = v.object({
	x1TeamAId: v.string(),
	x1TeamBId: v.string(),
	x2TeamAId: v.string(),
	x2TeamBId: v.string()
});

const fifthPlaceSelectionSchema = v.object({
	x3TeamAId: v.string(),
	x3TeamBId: v.string()
});

export const getFinalsData = query(async () => {
	requireAdmin();
	const [allTies, allTeams, standingA, standingB] = await Promise.all([
		listTies(),
		listTeams(),
		calculateGroupStandings('A'),
		calculateGroupStandings('B')
	]);

	return {
		ties: allTies.filter((t) => (finalPhases as readonly string[]).includes(t.phase)),
		teams: allTeams
			.filter(
				(team) => team.status === 'active' && (team.groupCode === 'A' || team.groupCode === 'B')
			)
			.map((team) => ({
				id: team.id,
				name: team.name,
				shortName: team.shortName,
				groupCode: team.groupCode
			})),
		standingA,
		standingB,
		semifinalSuggestions: buildSemifinalsAndFifthPlaceSuggestions(standingA, standingB)
	};
});

export const generateSemifinals = command(semifinalSelectionSchema, async (selection) => {
	requireAdmin();
	try {
		const changed = await generateSemifinalsService(selection, new Date().toISOString());
		notifyLiveBoard(['finals', 'schedule'], {
			finals: { phases: [...finalPhases] },
			schedule: { phases: [...finalPhases] }
		});
		return { message: `${changed}件の準決勝を生成しました。` };
	} catch (err) {
		error(400, err instanceof Error ? err.message : '生成に失敗しました');
	}
});

export const generateFifthPlace = command(fifthPlaceSelectionSchema, async (selection) => {
	requireAdmin();
	try {
		const changed = await generateFifthPlaceService(selection, new Date().toISOString());
		notifyLiveBoard(['finals', 'schedule'], {
			finals: { phases: [...finalPhases] },
			schedule: { phases: [...finalPhases] }
		});
		return { message: `${changed}件の5位決定戦を生成しました。` };
	} catch (err) {
		error(400, err instanceof Error ? err.message : '生成に失敗しました');
	}
});

export const generateFinals = command(async () => {
	requireAdmin();
	try {
		const changed = await generateFinalAndThirdPlace(new Date().toISOString());
		notifyLiveBoard(['finals', 'schedule'], {
			finals: { phases: [...finalPhases] },
			schedule: { phases: [...finalPhases] }
		});
		return { message: `${changed}件の決勝・3位決定戦を生成しました。` };
	} catch (err) {
		error(400, err instanceof Error ? err.message : '生成に失敗しました');
	}
});
