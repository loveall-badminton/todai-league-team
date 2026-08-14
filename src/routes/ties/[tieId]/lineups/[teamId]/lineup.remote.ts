import { form, getRequestEvent } from '$app/server';
import { requireTeamLineupAccess } from '$lib/server/auth/access';
import { notifyTie } from '$lib/server/realtime/broadcast';
import { saveLineupDraft, submitLineup } from '$lib/server/services/lineupService';
import { error } from '@sveltejs/kit';
import { submitLineupSchema } from './lineup.schema';

export const lineup = form(submitLineupSchema, async ({ items }) => {
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
		notifyTie(params.tieId!, ['schedule'], {
			schedule: { tieIds: [params.tieId!], scopes: ['tie_header', 'lineups'] }
		});
		return { message: 'オーダーを提出しました', warnings: submitValidation.warnings };
	} catch (err) {
		error(400, err instanceof Error ? err.message : '失敗');
	}
});
