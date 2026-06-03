import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getRequestDb } from '$lib/server/db/request';
import { createTournament, listTournaments } from '$lib/server/repositories/tournamentRepository';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getRequestDb(platform);
	return {
		tournaments: await listTournaments(db)
	};
};

export const actions: Actions = {
	create: async ({ request, platform }) => {
		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { message: '大会名は必須です' });

		const db = getRequestDb(platform);
		const id = await createTournament(db, {
			name,
			venue: emptyToNull(formData.get('venue')),
			startsAt: emptyToNull(formData.get('startsAt')),
			endsAt: emptyToNull(formData.get('endsAt')),
			now: new Date().toISOString()
		});

		redirect(303, `/tournaments/${id}`);
	}
};

function emptyToNull(value: FormDataEntryValue | null): string | null {
	const text = String(value ?? '').trim();
	return text === '' ? null : text;
}
