import { error, fail } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { RUBBER_DEFINITIONS, type RubberCode } from '$lib/domain/tokyoLeague';
import { getRequestDb } from '$lib/server/db/request';
import { lineupItems, lineupSubmissions, teamPlayers, teams } from '$lib/server/db/schema';
import { getTieWithRubbers } from '$lib/server/repositories/tokyoLeagueRepository';
import { saveLineupDraft, submitLineup } from '$lib/server/services/lineupService';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = getRequestDb(platform);
	const result = await getTieWithRubbers(db, params.tieId);
	if (!result) error(404, '対戦が見つかりません');

	const { tie } = result;
	const side = tie.teamAId === params.teamId ? 'A' : tie.teamBId === params.teamId ? 'B' : null;
	if (!side) error(404, 'このチームはこの対戦に参加していません');

	const team = await db.query.teams.findFirst({ where: eq(teams.id, params.teamId) });
	if (!team) error(404, 'チームが見つかりません');

	const [players, submission] = await Promise.all([
		db
			.select()
			.from(teamPlayers)
			.where(eq(teamPlayers.teamId, params.teamId))
			.orderBy(asc(teamPlayers.displayOrder), asc(teamPlayers.name)),
		db.query.lineupSubmissions.findFirst({
			where: and(
				eq(lineupSubmissions.tieId, params.tieId),
				eq(lineupSubmissions.teamId, params.teamId)
			)
		})
	]);

	const items = submission
		? await db
				.select()
				.from(lineupItems)
				.where(eq(lineupItems.submissionId, submission.id))
				.orderBy(asc(lineupItems.rubberCode))
		: [];

	return { tie, team, side, players, submission: submission ?? null, items };
};

export const actions: Actions = {
	saveDraft: async ({ request, params, platform }) => {
		const db = getRequestDb(platform);
		const formData = await request.formData();
		try {
			const validation = await saveLineupDraft(db, {
				tieId: params.tieId,
				teamId: params.teamId,
				items: parseItems(formData)
			});
			return { message: '下書きを保存しました', warnings: validation.warnings };
		} catch (caught) {
			return fail(400, { message: errorMessage(caught) });
		}
	},

	submit: async ({ request, params, platform }) => {
		const db = getRequestDb(platform);
		const formData = await request.formData();
		try {
			await saveLineupDraft(db, {
				tieId: params.tieId,
				teamId: params.teamId,
				items: parseItems(formData)
			});
			const validation = await submitLineup(db, {
				tieId: params.tieId,
				teamId: params.teamId
			});
			return { message: 'オーダーを提出しました', warnings: validation.warnings };
		} catch (caught) {
			return fail(400, { message: errorMessage(caught) });
		}
	}
};

function parseItems(formData: FormData) {
	return RUBBER_DEFINITIONS.map((rubber) => ({
		rubberCode: rubber.code as RubberCode,
		player1Id: String(formData.get(`${rubber.code}_1`) ?? ''),
		player2Id: String(formData.get(`${rubber.code}_2`) ?? '')
	}));
}

function errorMessage(caught: unknown) {
	return caught instanceof Error ? caught.message : '処理に失敗しました';
}
