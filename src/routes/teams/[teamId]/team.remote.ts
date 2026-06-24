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
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import {
	bulkCreatePlayersSchema,
	createPlayerSchema,
	updatePlayerSchema,
	updateTeamSchema
} from './team.schema';

export const updateTeam = form(updateTeamSchema, async ({ name, shortName, groupCode, status }) => {
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
});

export const createPlayer = form(createPlayerSchema, async ({ name, gender }) => {
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
});

export const updatePlayer = form(updatePlayerSchema, async ({ id, name, gender, status }) => {
	requireAdmin();
	await updateTeamPlayer({
		id,
		name,
		gender: gender === 'male' || gender === 'female' ? gender : 'unknown',
		status: status === 'inactive' ? 'inactive' : 'active',
		now: new Date().toISOString()
	});
	return { success: true, message: '選手を更新しました' };
});

export const bulkCreatePlayers = form(bulkCreatePlayersSchema, async ({ namesText, gender }) => {
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
});

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
});
