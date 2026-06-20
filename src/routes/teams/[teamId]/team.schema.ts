import * as v from 'valibot';

const groupCodeSchema = v.optional(v.picklist(['', 'A', 'B'] as const));
const teamStatusSchema = v.optional(v.picklist(['active', 'withdrawn'] as const));
const genderSchema = v.optional(v.picklist(['unknown', 'male', 'female'] as const));
const playerStatusSchema = v.optional(v.picklist(['active', 'inactive'] as const));

export const updateTeamSchema = v.object({
	name: v.pipe(v.string(), v.trim(), v.nonEmpty('チーム名は必須です')),
	shortName: v.optional(v.string()),
	groupCode: groupCodeSchema,
	status: teamStatusSchema
});

export const createPlayerSchema = v.object({
	name: v.pipe(v.string(), v.trim(), v.nonEmpty('選手名は必須です')),
	gender: genderSchema
});

export const updatePlayerSchema = v.object({
	id: v.pipe(v.string(), v.minLength(1)),
	name: v.pipe(v.string(), v.trim(), v.nonEmpty('選手名は必須です')),
	gender: genderSchema,
	status: playerStatusSchema
});

export const bulkCreatePlayersSchema = v.object({
	namesText: v.pipe(v.string(), v.nonEmpty('選手名を入力してください')),
	gender: genderSchema
});
