import * as v from 'valibot';

export const signInSchema = v.object({
	accountId: v.string(),
	password: v.string(),
	redirectTo: v.optional(v.string())
});
