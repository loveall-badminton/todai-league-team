import { form, getRequestEvent } from '$app/server';
import { requireTeamLineupAccess } from '$lib/server/auth/access';
import { saveLineupDraft, submitLineup } from '$lib/server/services/lineupService';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

const playerIdField = v.optional(v.string(), '');
const lineupItemSchema = <const TRubberCode extends string>(rubberCode: TRubberCode) =>
	v.object({
		rubberCode: v.literal(rubberCode),
		player1Id: playerIdField,
		player2Id: playerIdField
	});

const lineupSchema = v.object({
	items: v.tuple([
		lineupItemSchema('WD1'),
		lineupItemSchema('XD1'),
		lineupItemSchema('MD3'),
		lineupItemSchema('MD2'),
		lineupItemSchema('MD1')
	])
});

export const lineup = form(lineupSchema, async ({ items }) => {
	const event = getRequestEvent();
	const { params } = event;
	requireTeamLineupAccess(params.teamId!);

	try {
		await saveLineupDraft({
			tieId: params.tieId!,
			teamId: params.teamId!,
			items
		});

		const submitValidation = await submitLineup({ tieId: params.tieId!, teamId: params.teamId! });
		return { message: 'オーダーを提出しました', warnings: submitValidation.warnings };
	} catch (err) {
		error(400, err instanceof Error ? err.message : '失敗');
	}
});
