import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getRequestDb } from '$lib/server/db/request';
import {
	createTeamPlayer,
	deleteTeam,
	deleteTeamPlayer,
	getTeamWithPlayers,
	reorderTeamPlayers,
	updateTeam,
	updateTeamPlayer
} from '$lib/server/repositories/tokyoLeagueRepository';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = getRequestDb(platform);
	const team = await getTeamWithPlayers(db, params.teamId);
	if (!team) error(404, 'Team not found');
	return team;
};

export const actions: Actions = {
	updateTeam: async ({ request, params, platform }) => {
		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { message: 'チーム名は必須です' });

		const db = getRequestDb(platform);
		await updateTeam(db, {
			id: params.teamId,
			name,
			shortName: emptyToNull(formData.get('shortName')),
			groupCode: groupCodeOrNull(formData.get('groupCode')),
			status: statusOrActive(formData.get('status')),
			now: new Date().toISOString()
		});
		return { message: 'チームを更新しました' };
	},

	createPlayer: async ({ request, params, platform }) => {
		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		if (!name) return fail(400, { message: '選手名は必須です' });

		const db = getRequestDb(platform);
		const teamData = await getTeamWithPlayers(db, params.teamId);
		const nextOrder = teamData?.players.length ?? 0;

		await createTeamPlayer(db, {
			teamId: params.teamId,
			name,
			gender: genderOrUnknown(formData.get('gender')),
			displayOrder: nextOrder,
			now: new Date().toISOString()
		});
		return { message: '選手を追加しました' };
	},

	updatePlayer: async ({ request, platform }) => {
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '');
		const name = String(formData.get('name') ?? '').trim();
		if (!id || !name) return fail(400, { message: '選手名は必須です' });

		const db = getRequestDb(platform);
		await updateTeamPlayer(db, {
			id,
			name,
			gender: genderOrUnknown(formData.get('gender')),
			status: playerStatusOrActive(formData.get('status')),
			now: new Date().toISOString()
		});
		return { message: '選手を更新しました' };
	},

	reorderPlayers: async ({ request, platform }) => {
		const formData = await request.formData();
		const ids = JSON.parse(String(formData.get('ids') ?? '[]')) as string[];
		const db = getRequestDb(platform);
		await reorderTeamPlayers(db, ids, new Date().toISOString());
		return {};
	},

	deletePlayer: async ({ request, platform }) => {
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '');
		if (!id) return fail(400, { message: '選手IDが不正です' });
		const db = getRequestDb(platform);
		await deleteTeamPlayer(db, id);
		return { message: '選手を削除しました' };
	},

	deleteTeam: async ({ params, platform }) => {
		const db = getRequestDb(platform);
		await deleteTeam(db, params.teamId);
		redirect(303, '/teams');
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

function genderOrUnknown(value: FormDataEntryValue | null): 'male' | 'female' | 'unknown' {
	const text = String(value ?? '');
	return text === 'male' || text === 'female' ? text : 'unknown';
}

function statusOrActive(value: FormDataEntryValue | null): 'active' | 'withdrawn' {
	return String(value ?? '') === 'withdrawn' ? 'withdrawn' : 'active';
}

function playerStatusOrActive(value: FormDataEntryValue | null): 'active' | 'inactive' {
	return String(value ?? '') === 'inactive' ? 'inactive' : 'active';
}
