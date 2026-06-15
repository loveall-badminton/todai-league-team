import { requireAdmin } from '$lib/server/auth/access';
import {
	createTeamPlayer,
	getTeamWithPlayers,
	listTeams
} from '$lib/server/repositories/tokyoLeagueRepository';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Gender = 'male' | 'female' | 'unknown';

const genderMap: Record<string, Gender> = {
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

export const POST: RequestHandler = async ({ request }) => {
	requireAdmin();

	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	if (!file) error(400, 'ファイルが見つかりません');

	const text = await file.text();
	// eslint-disable-next-line no-irregular-whitespace
	const cleanText = text.replace(/^﻿/, '');
	const lines = cleanText
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0);

	if (lines.length < 2) error(400, 'データがありません');

	type Entry = { teamName: string; playerName: string; gender: Gender };
	const entries: Entry[] = [];

	for (const line of lines.slice(1)) {
		const parts = parseCsvLine(line);
		const teamName = parts[0]?.trim() ?? '';
		const playerName = parts[3]?.trim() ?? '';
		const genderStr = parts[4]?.trim() ?? '';

		if (!teamName || !playerName) continue;

		entries.push({
			teamName,
			playerName,
			gender: genderMap[genderStr] ?? 'unknown'
		});
	}

	const allTeams = await listTeams();
	const teamsByName = new Map(allTeams.map((t) => [t.name, t]));

	const now = new Date().toISOString();
	let addedCount = 0;
	const notFoundTeams: string[] = [];

	const byTeam = new Map<string, Entry[]>();
	for (const entry of entries) {
		if (!byTeam.has(entry.teamName)) byTeam.set(entry.teamName, []);
		byTeam.get(entry.teamName)!.push(entry);
	}

	for (const [teamName, teamEntries] of byTeam) {
		const team = teamsByName.get(teamName);
		if (!team) {
			notFoundTeams.push(teamName);
			continue;
		}

		const existing = await getTeamWithPlayers(team.id);
		const existingNames = new Set(existing?.players.map((p) => p.name) ?? []);
		const newPlayers = teamEntries.filter((e) => !existingNames.has(e.playerName));
		const startOrder = existing?.players.length ?? 0;

		for (let i = 0; i < newPlayers.length; i++) {
			const p = newPlayers[i];
			await createTeamPlayer({
				teamId: team.id,
				name: p.playerName,
				gender: p.gender,
				displayOrder: startOrder + i,
				now
			});
			addedCount++;
		}
	}

	return json({ addedCount, notFoundTeams });
};
