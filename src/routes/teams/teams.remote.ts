import { command, form } from '$app/server';
import { requireAdmin } from '$lib/server/auth/access';
import {
	createTeam,
	listTeams,
	reorderTeams
} from '$lib/server/repositories/tokyoLeagueRepository';
import { redirect } from '@sveltejs/kit';
import * as v from 'valibot';

export const create = form(
	v.object({
		name: v.pipe(v.string(), v.trim(), v.minLength(1, 'チーム名は必須です')),
		shortName: v.optional(v.string()),
		groupCode: v.optional(v.picklist(['', 'A', 'B'] as const))
	}),
	async ({ name, shortName, groupCode }) => {
		requireAdmin();
		const existing = await listTeams();
		const id = await createTeam({
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
	requireAdmin();
	await reorderTeams(ids, new Date().toISOString());
});
