import * as v from 'valibot';

export const updateTieFormFields = {
	tieCode: v.pipe(v.string(), v.trim(), v.nonEmpty()),
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
