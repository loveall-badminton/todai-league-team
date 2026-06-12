import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getRequestDb } from '$lib/server/db/request';
import { deleteTie, getTieWithRubbers, listTeams } from '$lib/server/repositories/tokyoLeagueRepository';
import {
	confirmTie,
	createMatchFromRubber,
	startTie,
	syncRubberResultFromMatch
} from '$lib/server/services/tieOperationService';
import {
	getLineupsForTie,
	lockLineup,
	revealLineups,
	unlockLineup,
	unrevealLineups
} from '$lib/server/services/lineupService';
import { getPublicRubbersForTie } from '$lib/server/services/liveBoardService';
import { teamPlayers, teams as teamsTable } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = getRequestDb(platform);
	const [tie, teams] = await Promise.all([
		getTieWithRubbers(db, params.tieId),
		listTeams(db)
	]);
	if (!tie) error(404, 'Tie not found');
	const lineups = await getLineupsForTie(db, params.tieId);
	const playerIds = [...new Set(
		lineups.flatMap(l => l.items.flatMap(i => [i.player1Id, i.player2Id])).filter((id): id is string => !!id)
	)];
	const revealed = tie.tie.status === 'playing' || tie.tie.status === 'finished' || tie.tie.status === 'confirmed';
	const [players, teamA, teamB, liveRubbers] = await Promise.all([
		playerIds.length > 0
			? db.select().from(teamPlayers).where(inArray(teamPlayers.id, playerIds))
			: Promise.resolve([]),
		tie.tie.teamAId ? db.query.teams.findFirst({ where: eq(teamsTable.id, tie.tie.teamAId) }) : null,
		tie.tie.teamBId ? db.query.teams.findFirst({ where: eq(teamsTable.id, tie.tie.teamBId) }) : null,
		getPublicRubbersForTie(db, params.tieId, revealed),
	]);
	return { ...tie, teams, lineups, players, teamA: teamA ?? null, teamB: teamB ?? null, liveRubbers };
};

export const actions: Actions = {
	start: async ({ params, platform }) => {
		const db = getRequestDb(platform);
		try {
			await startTie(db, params.tieId);
			return { message: '対戦を開始しました' };
		} catch (caught) {
			return fail(400, { message: errorMessage(caught) });
		}
	},
	createMatch: async ({ request, platform }) => {
		const formData = await request.formData();
		const rubberId = String(formData.get('rubberId') ?? '');
		if (!rubberId) return fail(400, { message: 'rubberIdが必要です' });
		const db = getRequestDb(platform);
		try {
			const matchId = await createMatchFromRubber(db, rubberId);
			redirect(303, `/referee/${matchId}`);
		} catch (caught) {
			return fail(400, { message: errorMessage(caught) });
		}
	},
	syncResult: async ({ request, platform }) => {
		const formData = await request.formData();
		const matchId = String(formData.get('matchId') ?? '');
		if (!matchId) return fail(400, { message: 'matchIdが必要です' });
		const db = getRequestDb(platform);
		await syncRubberResultFromMatch(db, matchId);
		return { message: '結果を同期しました' };
	},
	confirmTie: async ({ params, platform }) => {
		const db = getRequestDb(platform);
		await confirmTie(db, params.tieId);
		return { message: '対戦結果を確定しました' };
	},

	lockLineup: async ({ request, params, platform }) => {
		const db = getRequestDb(platform);
		const formData = await request.formData();
		const teamId = String(formData.get('teamId') ?? '');
		if (!teamId) return fail(400, { message: 'teamIdが必要です' });
		try {
			await lockLineup(db, { tieId: params.tieId, teamId });
			return { message: 'オーダーを承認しました' };
		} catch (caught) {
			return fail(400, { message: errorMessage(caught) });
		}
	},

	unlockLineup: async ({ request, params, platform }) => {
		const db = getRequestDb(platform);
		const formData = await request.formData();
		const teamId = String(formData.get('teamId') ?? '');
		if (!teamId) return fail(400, { message: 'teamIdが必要です' });
		try {
			await unlockLineup(db, { tieId: params.tieId, teamId });
			return { message: '承認を解除しました' };
		} catch (caught) {
			return fail(400, { message: errorMessage(caught) });
		}
	},

	revealLineups: async ({ params, platform }) => {
		const db = getRequestDb(platform);
		try {
			await revealLineups(db, params.tieId);
			return { message: 'オーダーを公開しました' };
		} catch (caught) {
			return fail(400, { message: errorMessage(caught) });
		}
	},

	unrevealLineups: async ({ params, platform }) => {
		const db = getRequestDb(platform);
		try {
			await unrevealLineups(db, params.tieId);
			return { message: 'オーダーの公開を取り消しました' };
		} catch (caught) {
			return fail(400, { message: errorMessage(caught) });
		}
	},

	deleteTie: async ({ params, platform }) => {
		const db = getRequestDb(platform);
		await deleteTie(db, params.tieId);
		redirect(303, '/ties');
	}
};

function errorMessage(caught: unknown) {
	return caught instanceof Error ? caught.message : '処理に失敗しました';
}
