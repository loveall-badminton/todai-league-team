import type { BackupState, MatchRow, RubberRow, TieRow } from '../types';

export const RUBBER_ORDER = ['WD1', 'XD1', 'MD3', 'MD2', 'MD1'] as const;

const ACTIVE_MATCH_STATUSES = new Set(['called', 'warmup', 'playing', 'interval', 'suspended']);
const FINISHED_MATCH_STATUSES = new Set(['finished', 'confirmed', 'forfeited', 'retired']);

const MATCH_STATUS_LABEL: Record<string, string> = {
	scheduled: '未実施',
	called: '招集中',
	warmup: '練習中',
	playing: '進行中',
	interval: 'インターバル',
	suspended: '中断',
	forfeited: '棄権',
	retired: '途中棄権',
	finished: '終了',
	confirmed: '確定',
	cancelled: '中止'
};

const TIE_STATUS_LABEL: Record<string, string> = {
	scheduled: '予定',
	lineup_pending: 'オーダー待ち',
	lineup_submitted: 'オーダー提出済',
	ready: '開始待ち',
	playing: '進行中',
	finished: '終了',
	confirmed: '確定',
	cancelled: '中止'
};

const PHASE_LABEL: Record<string, string> = {
	group_a: 'Aグループ',
	group_b: 'Bグループ',
	semifinal: '準決勝',
	final: '決勝',
	third_place: '3位決定戦',
	fifth_place: '5位決定戦',
	ranking_tiebreaker: '順位決定戦'
};

export function matchStatusLabel(status: string): string {
	return MATCH_STATUS_LABEL[status] ?? status;
}

export function tieStatusLabel(status: string): string {
	return TIE_STATUS_LABEL[status] ?? status;
}

export function phaseLabel(phase: string): string {
	return PHASE_LABEL[phase] ?? phase;
}

export function formatJst(iso: string): string {
	return (
		new Intl.DateTimeFormat('ja-JP', {
			timeZone: 'Asia/Tokyo',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		}).format(new Date(iso)) + ' JST'
	);
}

/** ファイルパスに安全な JST タイムスタンプ (例: 2026-07-02T10-00-00+09-00) */
export function toSafeTimestamp(iso: string): string {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Tokyo',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	}).formatToParts(new Date(iso));
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
	return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}-${get('minute')}-${get('second')}+09-00`;
}

interface GameStateLite {
	gameNo: number;
	score: { A: number; B: number };
	winnerSide: 'A' | 'B' | null;
}

export interface MatchView {
	match: MatchRow;
	rubber: RubberRow | null;
	tie: TieRow | null;
	tieLabel: string;
	rubberCode: string;
	sideAName: string;
	sideBName: string;
	playersLabel: string;
	games: GameStateLite[];
	gamesLabel: string;
	currentScoreLabel: string;
	statusLabel: string;
}

export interface CourtView {
	courtName: string;
	current: MatchView | null;
}

export interface TieView {
	tie: TieRow;
	label: string;
	rubberCells: string[]; // RUBBER_ORDER 順
	resultLabel: string;
}

export interface EmergencyView {
	state: BackupState;
	generatedAtJst: string;
	matches: MatchView[];
	courts: CourtView[];
	activeMatches: MatchView[];
	pendingMatches: MatchView[];
	finishedMatches: MatchView[];
	ties: TieView[];
}

export function buildEmergencyView(state: BackupState): EmergencyView {
	const rubberById = new Map(state.rubbers.map((r) => [r.id, r]));
	const tieById = new Map(state.ties.map((t) => [t.id, t]));
	const teamById = new Map(state.teams.map((t) => [t.id, t]));
	const snapshotByMatch = new Map(state.matchSnapshots.map((s) => [s.match_id, s.state_json]));
	const sidesByMatch = new Map<string, Map<string, string>>();
	for (const s of state.matchSides) {
		if (!sidesByMatch.has(s.match_id)) sidesByMatch.set(s.match_id, new Map());
		sidesByMatch.get(s.match_id)!.set(s.side, s.display_name);
	}
	const playersByMatchSide = new Map<string, string[]>();
	for (const p of state.matchSidePlayers) {
		const key = `${p.match_id}:${p.side}`;
		if (!playersByMatchSide.has(key)) playersByMatchSide.set(key, []);
		playersByMatchSide.get(key)!.push(p.name);
	}

	const matches: MatchView[] = state.matches.map((m) => {
		const rubber = m.rubber_id ? (rubberById.get(m.rubber_id) ?? null) : null;
		const tie = rubber ? (tieById.get(rubber.tie_id) ?? null) : null;
		const tieLabel = tie
			? `${tie.team_a_name ?? '未定'} vs ${tie.team_b_name ?? '未定'}`
			: (m.event_name ?? m.round_name ?? '-');
		const playersA =
			playersByMatchSide.get(`${m.id}:A`)?.join('/') ?? sidesByMatch.get(m.id)?.get('A') ?? '未定';
		const playersB =
			playersByMatchSide.get(`${m.id}:B`)?.join('/') ?? sidesByMatch.get(m.id)?.get('B') ?? '未定';

		let games: GameStateLite[] = [];
		const stateJson = snapshotByMatch.get(m.id);
		if (stateJson) {
			try {
				const parsed = JSON.parse(stateJson) as { games?: GameStateLite[] };
				games = (parsed.games ?? []).filter((g) => g?.score);
			} catch {
				games = [];
			}
		}
		const gamesLabel = games.map((g) => `${g.score.A}-${g.score.B}`).join(', ');
		const currentScoreLabel =
			gamesLabel || `${m.current_score_a}-${m.current_score_b} (G${m.current_game_no})`;

		return {
			match: m,
			rubber,
			tie,
			tieLabel,
			rubberCode: rubber?.code ?? m.discipline,
			sideAName: sidesByMatch.get(m.id)?.get('A') ?? playersA,
			sideBName: sidesByMatch.get(m.id)?.get('B') ?? playersB,
			playersLabel: `${playersA} vs ${playersB}`,
			games,
			gamesLabel,
			currentScoreLabel,
			statusLabel: matchStatusLabel(m.status)
		};
	});

	const matchViewById = new Map(matches.map((mv) => [mv.match.id, mv]));

	const activeMatches = matches.filter((mv) => ACTIVE_MATCH_STATUSES.has(mv.match.status));
	const pendingMatches = matches.filter((mv) => mv.match.status === 'scheduled');
	const finishedMatches = matches.filter((mv) => FINISHED_MATCH_STATUSES.has(mv.match.status));

	const courts: CourtView[] = state.courts
		.filter((c) => c.status === 'active')
		.map((c) => ({
			courtName: c.name,
			current: activeMatches.find((mv) => mv.match.court_id === c.id) ?? null
		}));

	const rubbersByTie = new Map<string, RubberRow[]>();
	for (const r of state.rubbers) {
		if (!rubbersByTie.has(r.tie_id)) rubbersByTie.set(r.tie_id, []);
		rubbersByTie.get(r.tie_id)!.push(r);
	}

	const ties: TieView[] = state.ties
		.filter((t) => t.status !== 'cancelled')
		.map((t) => {
			const rubbers = rubbersByTie.get(t.id) ?? [];
			const rubberCells = RUBBER_ORDER.map((code) => {
				const r = rubbers.find((x) => x.code === code);
				if (!r) return '-';
				const mv = r.match_id ? matchViewById.get(r.match_id) : null;
				const score = mv?.gamesLabel ? ` ${mv.gamesLabel}` : '';
				if (r.winner_side === 'A') return `○${t.team_a_name ?? 'A'}${score}`;
				if (r.winner_side === 'B') return `○${t.team_b_name ?? 'B'}${score}`;
				if (mv && ACTIVE_MATCH_STATUSES.has(mv.match.status))
					return `進行中 ${mv.currentScoreLabel}`;
				if (r.status === 'skipped') return '省略';
				return matchStatusLabel(mv?.match.status ?? 'scheduled');
			});
			const winnerName = t.winner_team_id ? (teamById.get(t.winner_team_id)?.name ?? '') : '';
			const resultLabel = winnerName
				? `${t.team_score_a}-${t.team_score_b} ${winnerName} 勝ち`
				: `${t.team_score_a}-${t.team_score_b} (${tieStatusLabel(t.status)})`;
			return {
				tie: t,
				label: `${t.tie_code} ${t.team_a_name ?? '未定'} vs ${t.team_b_name ?? '未定'}`,
				rubberCells,
				resultLabel
			};
		});

	return {
		state,
		generatedAtJst: formatJst(state.generatedAt),
		matches,
		courts,
		activeMatches,
		pendingMatches,
		finishedMatches,
		ties
	};
}
