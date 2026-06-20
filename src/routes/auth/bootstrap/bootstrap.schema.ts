import * as v from 'valibot';

export const createAdminSchema = v.object({
	accountId: v.string(),
	password: v.string(),
	name: v.string()
});
