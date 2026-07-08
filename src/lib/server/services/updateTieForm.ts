import { updateTieFormFields } from '$lib/domain/tieFormSchema';
import {
	assignOfficiatingTeams,
	updateTieSchedule
} from '$lib/server/repositories/tokyoLeagueRepository';
import { notifyLiveBoard } from '$lib/server/realtime/broadcast';
import { emptyToNull, uniqueNonEmpty, venueOrNull } from '$lib/utils/validation';
import * as v from 'valibot';

export { updateTieFormFields };

export const updateTieFormSchema = v.object(updateTieFormFields);

export type UpdateTieFormValues = {
	[K in keyof typeof updateTieFormFields]: v.InferOutput<(typeof updateTieFormFields)[K]>;
};

export async function persistUpdateTie(params: {
	id: string;
	scheduledStartAt?: string;
	venue?: string;
	courtBlockCode?: string;
	lineupDueAt?: string;
	operationNote?: string;
	scheduleChanged?: string;
	assignedTeamIds?: string[];
	officiatingNote?: string;
	now: string;
}) {
	await updateTieSchedule({
		id: params.id,
		scheduledStartAt: emptyToNull(params.scheduledStartAt),
		venue: venueOrNull(params.venue),
		courtBlockCode: emptyToNull(params.courtBlockCode),
		lineupDueAt: emptyToNull(params.lineupDueAt),
		operationNote: emptyToNull(params.operationNote),
		scheduleChanged: params.scheduleChanged === 'on',
		now: params.now
	});
	await assignOfficiatingTeams({
		tieId: params.id,
		assignedTeamIds: uniqueNonEmpty(params.assignedTeamIds),
		note: emptyToNull(params.officiatingNote),
		now: params.now
	});
	notifyLiveBoard(['schedule'], {
		// lineupDueAt の変更をオーダー入力ページにも届けるため lineups スコープを含める
		schedule: { tieIds: [params.id], scopes: ['tie_header', 'lineups'] }
	});
}
