import { command, form } from '$app/server';
import { requireAdmin } from '$lib/server/auth/access';
import {
	createTeam,
	createTeamPlayer,
	getTeamWithPlayers,
	listTeams,
	reorderTeams
} from '$lib/server/repositories/tokyoLeagueRepository';
import { redirect } from '@sveltejs/kit';
import * as v from 'valibot';
import { createTeamSchema, importTeamsSchema } from './teams.schema';

const CsvRow = v.object({
	teamName: v.pipe(v.string(), v.trim(), v.nonEmpty()),
	playerName: v.pipe(v.string(), v.trim(), v.nonEmpty()),
	gender: v.picklist(['male', 'female', 'unknown'])
});

const genderLabelMap: Record<string, 'male' | 'female' | 'unknown'> = {
	男性: 'male',
	女性: 'female',
	未設定: 'unknown'
};

function parseCsvLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQuotes) {
			if (ch === '"' && line[i + 1] === '"') {
				current += '"';
				i++;
			} else if (ch === '"') {
				inQuotes = false;
			} else {
				current += ch;
			}
		} else if (ch === '"') {
			inQuotes = true;
		} else if (ch === ',') {
			result.push(current);
			current = '';
		} else {
			current += ch;
		}
	}
	result.push(current);
	return result;
}

export const importTeams = form(importTeamsSchema, async ({ file }) => {
	requireAdmin();

	const csvText = await file.text();
	const cleanText = csvText.replace(/^\uFEFF/, '');
	const lines = cleanText
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0);

	if (lines.length < 2) throw new Error('データがありません');

	const entries: v.InferOutput<typeof CsvRow>[] = [];
	const errors: string[] = [];

	for (let i = 1; i < lines.length; i++) {
		const parts = parseCsvLine(lines[i]);
		const teamName = parts[0]?.trim() ?? '';
		const playerName = parts[3]?.trim() ?? '';
		const genderStr = parts[4]?.trim() ?? '';

		if (!teamName || !playerName) continue;

		const gender = genderLabelMap[genderStr] ?? 'unknown';

		const result = v.safeParse(CsvRow, { teamName, playerName, gender });
		if (!result.success) {
			errors.push(`${i + 1}行目: ${result.issues.map((issue) => issue.message).join(', ')}`);
			continue;
		}

		entries.push(result.output);
	}

	if (entries.length === 0 && errors.length > 0) {
		throw new Error(errors.join('\n'));
	}

	const allTeams = await listTeams();
	const teamsByName = new Map(allTeams.map((t) => [t.name, t]));
	const now = new Date().toISOString();
	let addedCount = 0;
	const createdTeams: string[] = [];

	const byTeam = new Map<string, typeof entries>();
	for (const entry of entries) {
		if (!byTeam.has(entry.teamName)) byTeam.set(entry.teamName, []);
		byTeam.get(entry.teamName)!.push(entry);
	}

	for (const [teamName, teamEntries] of byTeam) {
		const foundTeam = teamsByName.get(teamName);
		let teamId: string;
		if (foundTeam) {
			teamId = foundTeam.id;
		} else {
			teamId = await createTeam({ name: teamName, displayOrder: allTeams.length, now });
			createdTeams.push(teamName);
		}

		const existing = await getTeamWithPlayers(teamId);
		const existingNames = new Set(existing?.players.map((p) => p.name) ?? []);
		const newPlayers = teamEntries.filter((e) => !existingNames.has(e.playerName));
		const startOrder = existing?.players.length ?? 0;

		for (let i = 0; i < newPlayers.length; i++) {
			const p = newPlayers[i];
			await createTeamPlayer({
				teamId,
				name: p.playerName,
				gender: p.gender,
				displayOrder: startOrder + i,
				now
			});
			addedCount++;
		}
	}

	return { success: true, addedCount, createdTeams };
});

export const create = form(createTeamSchema, async ({ name, shortName, groupCode }) => {
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
});

export const reorder = command(v.object({ ids: v.array(v.string()) }), async ({ ids }) => {
	requireAdmin();
	await reorderTeams(ids, new Date().toISOString());
});
