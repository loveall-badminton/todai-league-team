import type {
	BackupState,
	CourtRow,
	EventRow,
	MatchRow,
	MatchSidePlayerRow,
	MatchSideRow,
	MatchSnapshotRow,
	RubberRow,
	TeamRow,
	TieRow
} from './types';

interface TournamentRow {
	id: string;
	name: string;
}

export async function resolveTournament(
	db: D1Database,
	tournamentId?: string
): Promise<TournamentRow> {
	if (tournamentId) {
		const row = await db
			.prepare('SELECT id, name FROM tournaments WHERE id = ?')
			.bind(tournamentId)
			.first<TournamentRow>();
		if (row) return row;
		throw new Error(`tournament not found: ${tournamentId}`);
	}

	const row = await db
		.prepare(
			`SELECT id, name FROM tournaments
			 WHERE status IN ('running', 'published')
			 ORDER BY CASE status WHEN 'running' THEN 0 ELSE 1 END, starts_at DESC, created_at DESC
			 LIMIT 1`
		)
		.first<TournamentRow>();
	if (row) return row;

	const fallback = await db
		.prepare('SELECT id, name FROM tournaments ORDER BY created_at DESC LIMIT 1')
		.first<TournamentRow>();
	if (fallback) return fallback;
	throw new Error('no tournament found');
}

export async function collectSnapshot(db: D1Database, tournamentId?: string): Promise<BackupState> {
	const tournament = await resolveTournament(db, tournamentId);

	const [
		teams,
		ties,
		rubbers,
		courts,
		matches,
		matchSides,
		matchSidePlayers,
		matchSnapshots,
		recentEvents,
		lastEvent
	] = await db.batch([
		db.prepare(
			`SELECT id, name, short_name, group_code, status, display_order
			 FROM teams ORDER BY display_order, name`
		),
		db.prepare(
			`SELECT t.id, t.tie_code, t.phase, t.group_code, t.round_label, t.status,
			        t.team_score_a, t.team_score_b, t.winner_team_id, t.display_order,
			        t.scheduled_start_at, t.venue, t.court_block_code, t.operation_note,
			        t.team_a_id, t.team_b_id,
			        ta.name AS team_a_name, tb.name AS team_b_name
			 FROM ties t
			 LEFT JOIN teams ta ON ta.id = t.team_a_id
			 LEFT JOIN teams tb ON tb.id = t.team_b_id
			 ORDER BY t.display_order, t.tie_code`
		),
		db.prepare(
			`SELECT id, tie_id, code, discipline, display_order, match_id, status, winner_side
			 FROM rubbers ORDER BY tie_id, display_order`
		),
		db
			.prepare(
				`SELECT id, name, display_order, status FROM courts
				 WHERE tournament_id = ? ORDER BY display_order, name`
			)
			.bind(tournament.id),
		db
			.prepare(
				`SELECT m.id, m.court_id, c.name AS court_name, m.discipline, m.status,
				        m.current_game_no, m.current_score_a, m.current_score_b,
				        m.games_won_a, m.games_won_b, m.winner_side, m.current_serving_side,
				        m.last_seq_no, m.rubber_id, m.match_no, m.display_order,
				        m.event_name, m.round_name,
				        m.scheduled_start_at, m.actual_start_at, m.actual_end_at
				 FROM matches m
				 LEFT JOIN courts c ON c.id = m.court_id
				 WHERE m.tournament_id = ?
				 ORDER BY m.display_order, m.id`
			)
			.bind(tournament.id),
		db
			.prepare(
				`SELECT ms.match_id, ms.side, ms.display_name
				 FROM match_sides ms JOIN matches m ON m.id = ms.match_id
				 WHERE m.tournament_id = ?`
			)
			.bind(tournament.id),
		db
			.prepare(
				`SELECT p.match_id, p.side, p.player_order, p.name, p.team_name
				 FROM match_side_players p JOIN matches m ON m.id = p.match_id
				 WHERE m.tournament_id = ?
				 ORDER BY p.match_id, p.side, p.player_order`
			)
			.bind(tournament.id),
		db
			.prepare(
				`SELECT s.match_id, s.state_json
				 FROM match_snapshots s JOIN matches m ON m.id = s.match_id
				 WHERE m.tournament_id = ?`
			)
			.bind(tournament.id),
		db
			.prepare(
				`SELECT se.rowid AS global_id, se.id, se.match_id, se.seq_no, se.event_type,
				        se.side, se.game_no, se.score_a_after, se.score_b_after,
				        se.actor_name, se.created_at
				 FROM score_events se JOIN matches m ON m.id = se.match_id
				 WHERE m.tournament_id = ?
				 ORDER BY se.rowid DESC LIMIT 500`
			)
			.bind(tournament.id),
		db
			.prepare(
				`SELECT COALESCE(MAX(se.rowid), 0) AS last_event_id
				 FROM score_events se JOIN matches m ON m.id = se.match_id
				 WHERE m.tournament_id = ?`
			)
			.bind(tournament.id)
	]);

	return {
		generatedAt: new Date().toISOString(),
		tournamentId: tournament.id,
		tournamentName: tournament.name,
		lastEventId: Number(
			(lastEvent.results?.[0] as { last_event_id?: number } | undefined)?.last_event_id ?? 0
		),
		teams: (teams.results ?? []) as unknown as TeamRow[],
		ties: (ties.results ?? []) as unknown as TieRow[],
		rubbers: (rubbers.results ?? []) as unknown as RubberRow[],
		courts: (courts.results ?? []) as unknown as CourtRow[],
		matches: (matches.results ?? []) as unknown as MatchRow[],
		matchSides: (matchSides.results ?? []) as unknown as MatchSideRow[],
		matchSidePlayers: (matchSidePlayers.results ?? []) as unknown as MatchSidePlayerRow[],
		matchSnapshots: (matchSnapshots.results ?? []) as unknown as MatchSnapshotRow[],
		recentEvents: ((recentEvents.results ?? []) as unknown as EventRow[]).slice().reverse()
	};
}
