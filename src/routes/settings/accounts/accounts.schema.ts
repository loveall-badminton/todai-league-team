import * as v from 'valibot';

const accountTypeSchema = v.picklist(['participant', 'team', 'admin'] as const);

export const createAccountSchema = v.object({
	accountType: accountTypeSchema,
	accountId: v.pipe(v.string(), v.trim()),
	name: v.pipe(v.string(), v.trim(), v.nonEmpty('表示名は必須です')),
	password: v.pipe(v.string(), v.nonEmpty('パスワードは必須です')),
	teamId: v.optional(v.string())
});

export const updateAccountSchema = v.object({
	userId: v.pipe(v.string(), v.trim(), v.nonEmpty()),
	name: v.pipe(v.string(), v.trim(), v.nonEmpty('表示名は必須です')),
	accountType: accountTypeSchema,
	teamId: v.optional(v.string())
});

export const resetPasswordSchema = v.object({
	userId: v.pipe(v.string(), v.trim(), v.nonEmpty()),
	password: v.pipe(v.string(), v.nonEmpty('パスワードは必須です'))
});
