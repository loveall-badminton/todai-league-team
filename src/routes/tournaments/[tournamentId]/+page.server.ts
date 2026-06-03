import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getRequestDb } from '$lib/server/db/request';
import {
	createCourt,
	getTournament,
	listCourts,
	listMatchesForTournament
} from '$lib/server/repositories/tournamentRepository';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = getRequestDb(platform);
	const tournament = await getTournament(db, params.tournamentId);
	if (!tournament) error(404, 'Tournament not found');

	return {
		tournament,
		courts: await listCourts(db, params.tournamentId),
		matches: await listMatchesForTournament(db, params.tournamentId)
	};
};

export const actions: Actions = {
	createCourt: async ({ request, params, platform }) => {
		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { message: 'コート名は必須です' });

		const displayOrder = Number(formData.get('displayOrder') ?? 0);
		const db = getRequestDb(platform);
		await createCourt(db, {
			tournamentId: params.tournamentId,
			name,
			displayOrder: Number.isFinite(displayOrder) ? displayOrder : 0,
			now: new Date().toISOString()
		});

		return { message: 'コートを作成しました' };
	}
};
