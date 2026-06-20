import { updateTieFormFields } from '$lib/domain/tieFormSchema';
import * as v from 'valibot';

export const updateTieSchema = v.object({
	id: v.pipe(v.string(), v.trim(), v.nonEmpty()),
	...updateTieFormFields
});

export const setManualRankSchema = v.object({
	teamId: v.pipe(v.string(), v.trim(), v.nonEmpty()),
	manualRank: v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)),
	reason: v.optional(v.string())
});

export const createTiebreakerSchema = v.object({
	teamAId: v.pipe(v.string(), v.trim(), v.nonEmpty()),
	teamBId: v.pipe(v.string(), v.trim(), v.nonEmpty()),
	discipline: v.picklist(['MD', 'XD', 'WD'] as const),
	playerA1Id: v.pipe(v.string(), v.trim(), v.nonEmpty()),
	playerA2Id: v.pipe(v.string(), v.trim(), v.nonEmpty()),
	playerB1Id: v.pipe(v.string(), v.trim(), v.nonEmpty()),
	playerB2Id: v.pipe(v.string(), v.trim(), v.nonEmpty()),
	reason: v.pipe(v.string(), v.trim(), v.nonEmpty())
});
