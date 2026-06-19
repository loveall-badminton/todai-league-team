import {
	assignOfficiatingTeams,
	updateTieSchedule
} from '$lib/server/repositories/tokyoLeagueRepository';
import { notifyLiveBoard } from '$lib/server/realtime/broadcast';
import { emptyToNull, uniqueNonEmpty, venueOrNull } from '$lib/utils/validation';
import * as v from 'valibot';

export const updateTieFormFields = {
	tieCode: v.pipe(v.string(), v.trim(), v.minLength(1)),
	scheduledStartAt: v.optional(v.string()),
	venue: v.optional(v.string()),
	courtBlockCode: v.optional(v.string()),
	lineupDueAt: v.optional(v.string()),
	operationNote: v.optional(v.string()),
	scheduleChanged: v.optional(v.string()),
	assignedTeamIds: v.optional(
		v.union([
			v.array(v.string()),
			v.pipe(
				v.literal(''),
				v.transform(() => [] as string[])
			)
		])
	),
	officiatingNote: v.optional(v.string())
} as const;

export type UpdateTieFormValues = {
	[K in keyof typeof updateTieFormFields]: v.InferOutput<(typeof updateTieFormFields)[K]>;
};

export async function persistUpdateTie(params: {
	id: string;
	tieCode: string;
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
		tieCode: params.tieCode,
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
	notifyLiveBoard(['schedule']);
}
