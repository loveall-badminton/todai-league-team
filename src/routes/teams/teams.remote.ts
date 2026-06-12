import { command, form, getRequestEvent } from '$app/server';
import { redirect } from '@sveltejs/kit';
import * as v from 'valibot';
import { requireAdmin } from '$lib/server/auth/access';
import { getRequestDb } from '$lib/server/db/request';
import {
	createTeam,
	listTeams,
	reorderTeams
} from '$lib/server/repositories/tokyoLeagueRepository';

export const create = form(
	v.object({
		name: v.pipe(v.string(), v.trim(), v.minLength(1, 'チーム名は必須です')),
		shortName: v.optional(v.string()),
		groupCode: v.optional(v.picklist(['', 'A', 'B'] as const))
	}),
	async ({ name, shortName, groupCode }) => {
		const event = getRequestEvent();
		requireAdmin(event);
		const db = getRequestDb(event.platform);
		const existing = await listTeams(db);
		const id = await createTeam(db, {
			name,
			shortName: shortName?.trim() || null,
			groupCode: groupCode === 'A' || groupCode === 'B' ? groupCode : null,
			displayOrder: existing.length,
			now: new Date().toISOString()
		});
		redirect(303, `/teams/${id}`);
	}
);

export const reorder = command(v.object({ ids: v.array(v.string()) }), async ({ ids }) => {
	const event = getRequestEvent();
	requireAdmin(event);
	await reorderTeams(getRequestDb(event.platform), ids, new Date().toISOString());
});
