import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { MatchDiscipline } from '$lib/domain/types';
import { getRequestDb } from '$lib/server/db/request';
import { createMatchWithPlayers } from '$lib/server/repositories/matchRepository';
import { getTournament, listCourts } from '$lib/server/repositories/tournamentRepository';

const disciplines = ['MS', 'WS', 'MD', 'WD', 'XD'] as const;

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = getRequestDb(platform);
	const tournament = await getTournament(db, params.tournamentId);
	if (!tournament) error(404, 'Tournament not found');

	return {
		tournament,
		courts: await listCourts(db, params.tournamentId),
		disciplines
	};
};

export const actions: Actions = {
	default: async ({ request, params, platform }) => {
		const formData = await request.formData();
		const discipline = String(formData.get('discipline') ?? 'MS') as MatchDiscipline;
		if (!disciplines.includes(discipline)) return fail(400, { message: '種目が不正です' });

		const isDoubles = discipline === 'MD' || discipline === 'WD' || discipline === 'XD';
		const a1 = text(formData, 'sideAPlayer1Name');
		const a2 = text(formData, 'sideAPlayer2Name');
		const b1 = text(formData, 'sideBPlayer1Name');
		const b2 = text(formData, 'sideBPlayer2Name');
		if (!a1 || !b1 || (isDoubles && (!a2 || !b2))) {
			return fail(400, { message: isDoubles ? 'ダブルスは4名すべて必須です' : 'A1/B1は必須です' });
		}

		const players = [
			{ side: 'A' as const, order: 1 as const, name: a1 },
			...(isDoubles ? [{ side: 'A' as const, order: 2 as const, name: a2 }] : []),
			{ side: 'B' as const, order: 1 as const, name: b1 },
			...(isDoubles ? [{ side: 'B' as const, order: 2 as const, name: b2 }] : [])
		];

		const db = getRequestDb(platform);
		const matchId = await createMatchWithPlayers(db, {
			tournamentId: params.tournamentId,
			courtId: text(formData, 'courtId') || null,
			discipline,
			eventName: text(formData, 'eventName') || null,
			category: text(formData, 'category') || null,
			roundName: text(formData, 'roundName') || null,
			players,
			now: new Date().toISOString()
		});

		redirect(303, `/referee/${matchId}`);
	}
};

function text(formData: FormData, key: string): string {
	return String(formData.get(key) ?? '').trim();
}
