import { requireAdmin } from '$lib/server/auth/access';
import { listAllTeamsWithPlayers } from '$lib/server/repositories/tokyoLeagueRepository';
import type { RequestHandler } from './$types';

const genderLabel = (gender: string) => {
	if (gender === 'male') return '男性';
	if (gender === 'female') return '女性';
	return '未設定';
};

function csvCell(value: string): string {
	return `"${value.replace(/"/g, '""')}"`;
}

export const GET: RequestHandler = async () => {
	requireAdmin();

	const allTeams = await listAllTeamsWithPlayers();

	const header = ['チーム名', '略称', 'リーグ', '選手名', '性別'];
	const rows: string[][] = [header];

	for (const { team, players } of allTeams) {
		if (players.length === 0) {
			rows.push([team.name, team.shortName ?? '', team.groupCode ?? '', '', '']);
		} else {
			for (const player of players) {
				rows.push([
					team.name,
					team.shortName ?? '',
					team.groupCode ?? '',
					player.name,
					genderLabel(player.gender)
				]);
			}
		}
	}

	// BOM for Excel compatibility
	const csv = '﻿' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');

	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': 'attachment; filename="players.csv"'
		}
	});
};
