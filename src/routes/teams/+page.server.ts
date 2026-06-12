import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getRequestDb } from '$lib/server/db/request';
import {
	createTeam,
	listTeams,
	reorderTeams
} from '$lib/server/repositories/tokyoLeagueRepository';
import { ensureDefaultSettings } from '$lib/server/services/tokyoLeagueSetupService';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getRequestDb(platform);
	await ensureDefaultSettings(db);
	return {
		teams: await listTeams(db)
	};
};

export const actions: Actions = {
	create: async ({ request, platform }) => {
		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { message: 'チーム名は必須です' });

		const db = getRequestDb(platform);
		const existing = await listTeams(db);
		const id = await createTeam(db, {
			name,
			shortName: emptyToNull(formData.get('shortName')),
			groupCode: groupCodeOrNull(formData.get('groupCode')),
			displayOrder: existing.length,
			now: new Date().toISOString()
		});

		redirect(303, `/teams/${id}`);
	},

	reorder: async ({ request, platform }) => {
		const formData = await request.formData();
		const ids = JSON.parse(String(formData.get('ids') ?? '[]')) as string[];
		const db = getRequestDb(platform);
		await reorderTeams(db, ids, new Date().toISOString());
		return {};
	}
};

function emptyToNull(value: FormDataEntryValue | null): string | null {
	const text = String(value ?? '').trim();
	return text === '' ? null : text;
}

function groupCodeOrNull(value: FormDataEntryValue | null): 'A' | 'B' | null {
	const text = String(value ?? '');
	return text === 'A' || text === 'B' ? text : null;
}
