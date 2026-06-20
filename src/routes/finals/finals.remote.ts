import { command, query } from '$app/server';
import { requireAdmin } from '$lib/server/auth/access';
import { notifyLiveBoard } from '$lib/server/realtime/broadcast';
import { listTies } from '$lib/server/repositories/tokyoLeagueRepository';
import {
	generateFinalAndThirdPlace,
	generateSemifinalsAndFifthPlace
} from '$lib/server/services/finalsService';
import { calculateGroupStandings } from '$lib/server/services/standingService';
import { error } from '@sveltejs/kit';

const finalPhases = ['semifinal', 'fifth_place', 'third_place', 'final'] as const;

export const getFinalsData = query(async () => {
	requireAdmin();
	const [allTies, standingA, standingB] = await Promise.all([
		listTies(),
		calculateGroupStandings('A'),
		calculateGroupStandings('B')
	]);

	const groupATies = allTies.filter((t) => t.phase === 'group_a');
	const groupBTies = allTies.filter((t) => t.phase === 'group_b');

	const groupAAllDone = groupATies.length > 0 && groupATies.every((t) => !!t.winnerTeamId);
	const groupBAllDone = groupBTies.length > 0 && groupBTies.every((t) => !!t.winnerTeamId);
	const noTiebreakerA = standingA.every((s) => !s.requiresTiebreaker);
	const noTiebreakerB = standingB.every((s) => !s.requiresTiebreaker);

	return {
		ties: allTies.filter((t) => (finalPhases as readonly string[]).includes(t.phase)),
		groupStandingsReady: groupAAllDone && groupBAllDone && noTiebreakerA && noTiebreakerB,
		groupAAllDone,
		groupBAllDone,
		noTiebreakerA,
		noTiebreakerB
	};
});

export const generateSemifinals = command(async () => {
	requireAdmin();
	try {
		const changed = await generateSemifinalsAndFifthPlace(new Date().toISOString());
		notifyLiveBoard(['finals', 'schedule'], {
			finals: { phases: [...finalPhases] },
			schedule: { phases: [...finalPhases] }
		});
		return { message: `${changed}件の決勝トーナメント対戦を生成しました。` };
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
