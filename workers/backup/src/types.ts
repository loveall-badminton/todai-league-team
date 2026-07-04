export interface Env {
	DB: D1Database;
	BACKUP_BUCKET: R2Bucket;
	BROWSER: Fetcher;
	BACKUP_SECRET: string;
	DOWNLOAD_TOKEN: string;
	TOURNAMENT_ID?: string;
}

export interface TeamRow {
	id: string;
	name: string;
	short_name: string | null;
	group_code: string | null;
	status: string;
	display_order: number;
}

export interface TieRow {
	id: string;
	tie_code: string;
	phase: string;
	group_code: string | null;
	round_label: string | null;
	status: string;
	team_score_a: number;
	team_score_b: number;
	winner_team_id: string | null;
	display_order: number;
	scheduled_start_at: string | null;
	venue: string | null;
	court_block_code: string | null;
	operation_note: string | null;
	team_a_id: string | null;
	team_b_id: string | null;
	team_a_name: string | null;
	team_b_name: string | null;
}

export interface RubberRow {
	id: string;
	tie_id: string;
	code: string;
	discipline: string;
	display_order: number;
	match_id: string | null;
	status: string;
	winner_side: string | null;
}

export interface CourtRow {
	id: string;
	name: string;
	display_order: number;
	status: string;
}

export interface MatchRow {
	id: string;
	court_id: string | null;
	court_name: string | null;
	discipline: string;
	status: string;
	current_game_no: number;
	current_score_a: number;
	current_score_b: number;
	games_won_a: number;
	games_won_b: number;
	winner_side: string | null;
	current_serving_side: string | null;
	last_seq_no: number;
	rubber_id: string | null;
	match_no: number | null;
	display_order: number;
	event_name: string | null;
	round_name: string | null;
	scheduled_start_at: string | null;
	actual_start_at: string | null;
	actual_end_at: string | null;
}

export interface MatchSideRow {
	match_id: string;
	side: string;
	display_name: string;
}

export interface MatchSidePlayerRow {
	id: string;
	match_id: string;
	side: string;
	player_order: number;
	name: string;
	team_name: string | null;
}

/** 進行中試合のスコアシート描画用イベント行 */
export interface ScoresheetEventRow {
	match_id: string;
	seq_no: number;
	event_type: string;
	side: string | null;
	game_no: number | null;
	score_a_after: number | null;
	score_b_after: number | null;
	server_player_id_before: string | null;
	server_player_id_after: string | null;
	receiver_player_id_before: string | null;
	receiver_player_id_after: string | null;
	target_seq_no: number | null;
}

export interface LineupRow {
	tie_id: string;
	side: string;
	status: string;
	rubber_code: string;
	player1_name: string | null;
	player2_name: string | null;
}

export interface MatchSnapshotRow {
	match_id: string;
	state_json: string;
}

export interface EventRow {
	global_id: number;
	id: string;
	match_id: string;
	seq_no: number;
	event_type: string;
	side: string | null;
	game_no: number | null;
	score_a_after: number | null;
	score_b_after: number | null;
	actor_name: string | null;
	created_at: string;
}

export interface BackupState {
	generatedAt: string;
	tournamentId: string;
	tournamentName: string;
	lastEventId: number;
	teams: TeamRow[];
	ties: TieRow[];
	rubbers: RubberRow[];
	courts: CourtRow[];
	matches: MatchRow[];
	matchSides: MatchSideRow[];
	matchSidePlayers: MatchSidePlayerRow[];
	matchSnapshots: MatchSnapshotRow[];
	lineups: LineupRow[];
	scoreEvents: ScoresheetEventRow[];
	recentEvents: EventRow[];
}
