import type { EmergencyView } from './view';

function csvCell(value: unknown): string {
	const s = String(value ?? '');
	if (/[",\n\r]/.test(s)) {
		return `"${s.replaceAll('"', '""')}"`;
	}
	return s;
}

export function renderScoresCsv(view: EmergencyView): string {
	const header =
		'tie_id,tie_name,match_id,rubber_code,court,status,home_team,away_team,home_players,away_players,game1,game2,game3,winner';

	const playersByMatchSide = new Map<string, string[]>();
	for (const p of view.state.matchSidePlayers) {
		const key = `${p.match_id}:${p.side}`;
		if (!playersByMatchSide.has(key)) playersByMatchSide.set(key, []);
		playersByMatchSide.get(key)!.push(p.name);
	}

	const rows = view.matches.map((mv) => {
		const m = mv.match;
		const gameCells = [0, 1, 2].map((i) => {
			const g = mv.games[i];
			return g ? `${g.score.A}-${g.score.B}` : '';
		});
		const winner = m.winner_side === 'A' ? mv.sideAName : m.winner_side === 'B' ? mv.sideBName : '';
		return [
			mv.tie?.id ?? '',
			mv.tie ? `${mv.tie.team_a_name ?? ''} vs ${mv.tie.team_b_name ?? ''}` : '',
			m.id,
			mv.rubberCode,
			m.court_name ?? '',
			m.status,
			mv.sideAName,
			mv.sideBName,
			playersByMatchSide.get(`${m.id}:A`)?.join('/') ?? '',
			playersByMatchSide.get(`${m.id}:B`)?.join('/') ?? '',
			...gameCells,
			winner
		]
			.map(csvCell)
			.join(',');
	});

	// Excel で文字化けしないよう BOM を付ける
	return '﻿' + [header, ...rows].join('\r\n') + '\r\n';
}
