import { command, form, getRequestEvent } from '$app/server';
import { requireAdmin } from '$lib/server/auth/access';
import {
	bulkCreateTeamPlayers,
	createTeamPlayer,
	deleteTeamPlayer,
	deleteTeam as deleteTeamRepo,
	getTeamWithPlayers,
	reorderTeamPlayers,
	updateTeamPlayer,
	updateTeam as updateTeamRepo
} from '$lib/server/repositories/tokyoLeagueRepository';
import { error, redirect } from '@sveltejs/kit';
import * as v from 'valibot';

const groupCodeSchema = v.optional(v.picklist(['', 'A', 'B'] as const));
const teamStatusSchema = v.optional(v.picklist(['active', 'withdrawn'] as const));
const genderSchema = v.optional(v.picklist(['unknown', 'male', 'female'] as const));
const playerStatusSchema = v.optional(v.picklist(['active', 'inactive'] as const));

export const updateTeam = form(
	v.object({
		name: v.pipe(v.string(), v.trim(), v.minLength(1, 'チーム名は必須です')),
		shortName: v.optional(v.string()),
		groupCode: groupCodeSchema,
		status: teamStatusSchema
	}),
	async ({ name, shortName, groupCode, status }) => {
		const event = getRequestEvent();
		requireAdmin();
		await updateTeamRepo({
			id: event.params.teamId!,
			name,
			shortName: shortName?.trim() || null,
			groupCode: groupCode === 'A' || groupCode === 'B' ? groupCode : null,
			status: status === 'withdrawn' ? 'withdrawn' : 'active',
			now: new Date().toISOString()
		});
		return { message: 'チームを更新しました' };
	}
);

export const createPlayer = form(
	v.object({
		name: v.pipe(v.string(), v.trim(), v.minLength(1, '選手名は必須です')),
		gender: genderSchema
	}),
	async ({ name, gender }) => {
		const event = getRequestEvent();
		requireAdmin();
		const teamData = await getTeamWithPlayers(event.params.teamId!);
		const nextOrder = teamData?.players.length ?? 0;
		await createTeamPlayer({
			teamId: event.params.teamId!,
			name,
			gender: gender === 'male' || gender === 'female' ? gender : 'unknown',
			displayOrder: nextOrder,
			now: new Date().toISOString()
		});
		return { message: '選手を追加しました' };
	}
);

export const updatePlayer = form(
	v.object({
		id: v.pipe(v.string(), v.minLength(1)),
		name: v.pipe(v.string(), v.trim(), v.minLength(1, '選手名は必須です')),
		gender: genderSchema,
		status: playerStatusSchema
	}),
	async ({ id, name, gender, status }) => {
		requireAdmin();
		await updateTeamPlayer({
			id,
			name,
			gender: gender === 'male' || gender === 'female' ? gender : 'unknown',
			status: status === 'inactive' ? 'inactive' : 'active',
			now: new Date().toISOString()
		});
		return { success: true, message: '選手を更新しました' };
	}
);

export const bulkCreatePlayers = form(
	v.object({
		namesText: v.pipe(v.string(), v.minLength(1, '選手名を入力してください')),
		gender: genderSchema
	}),
	async ({ namesText, gender }) => {
		const event = getRequestEvent();
		requireAdmin();

		const names = namesText
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0);

		if (names.length === 0) {
			error(400, '有効な選手名がありません');
		}

		const teamData = await getTeamWithPlayers(event.params.teamId!);
		const nextOrder = teamData?.players.length ?? 0;

		const addedCount = await bulkCreateTeamPlayers({
			teamId: event.params.teamId!,
			names,
			gender: gender === 'male' || gender === 'female' ? gender : 'unknown',
			displayOrderStart: nextOrder,
			now: new Date().toISOString()
		});

		return { message: `${addedCount}名の選手を追加しました`, addedCount };
	}
);

export const reorderPlayers = command(v.object({ ids: v.array(v.string()) }), async ({ ids }) => {
	requireAdmin();
	await reorderTeamPlayers(ids, new Date().toISOString());
});

export const deletePlayer = command(v.object({ id: v.string() }), async ({ id }) => {
	requireAdmin();
	if (!id) error(400, '選手IDが不正です');
	await deleteTeamPlayer(id);
});

export const deleteTeam = command(async () => {
	const event = getRequestEvent();
	requireAdmin();
	await deleteTeamRepo(event.params.teamId!);
	redirect(303, '/teams');
});
