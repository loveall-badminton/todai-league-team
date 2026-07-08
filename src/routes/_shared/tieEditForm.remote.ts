import { form } from '$app/server';
import { error } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth/access';
import { persistUpdateTie } from '$lib/server/services/updateTieForm';
import { updateTieFormFields } from '$lib/domain/tieFormSchema';
import { actionErrorMessage } from '$lib/server/errors';
import * as v from 'valibot';

const updateTieSchema = v.object({
	id: v.pipe(v.string(), v.trim(), v.nonEmpty()),
	...updateTieFormFields
});

export const updateTie = form(updateTieSchema, async (values) => {
	requireAdmin();
	try {
		await persistUpdateTie({ ...values, now: new Date().toISOString() });
	} catch (caught) {
		error(400, actionErrorMessage(caught, '対戦情報の保存に失敗しました'));
	}
	return { message: '対戦情報を保存しました', success: true };
});
