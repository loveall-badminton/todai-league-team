import * as v from 'valibot';

export const createTieSchema = v.object({
	tieCode: v.pipe(v.string(), v.trim(), v.nonEmpty('コードは必須です')),
	scoringRuleId: v.pipe(v.string(), v.trim(), v.nonEmpty('得点ルールは必須です')),
	groupCode: v.optional(v.string()),
	phase: v.optional(v.string()),
	scheduledStartAt: v.optional(v.string()),
	teamAId: v.optional(v.string()),
	teamBId: v.optional(v.string()),
	roundLabel: v.optional(v.string()),
	venue: v.optional(v.string()),
	courtBlockCode: v.optional(v.string()),
	lineupDueAt: v.optional(v.string()),
	lineupDuePolicy: v.optional(v.string())
});
