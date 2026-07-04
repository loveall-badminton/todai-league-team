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

const LINEUP_STATUS_LABEL: Record<string, string> = {
	draft: '下書き',
	submitted: '提出済',
	locked: '承認済',
	revealed: '公開済'
};

export function tieStatusLabel(status: string): string {
	return TIE_STATUS_LABEL[status] ?? status;
}

export function lineupStatusLabel(status: string): string {
	return LINEUP_STATUS_LABEL[status] ?? status;
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

export interface SheetPlayer {
	id: string;
	side: 'A' | 'B';
	order: number;
	name: string;
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
	players: SheetPlayer[];
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

export interface LineupSideView {
	tieLabel: string;
	teamName: string;
	statusLabel: string;
	/** RUBBER_ORDER 順のペア表記("山田・田中"、未定は '-') */
	pairCells: string[];
}

/** 紙スコアシート1枚分のデータ(オーダー提出済み・未終了の試合) */
export interface ScoresheetView {
	matchView: MatchView | null;
	matchNo: number | null;
	courtName: string | null;
	rubberCode: string;
	tieLabel: string;
	roundLabel: string | null;
	teamAName: string;
	teamBName: string;
	/** [選手1, 選手2](不明は空文字) */
	namesA: [string, string];
	namesB: [string, string];
	/** 第1〜3ゲームの確定スコア(未実施・進行中は null) */
	gameScores: Array<{ a: number; b: number } | null>;
	startAtJst: string | null;
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
	lineups: LineupSideView[];
	scoresheets: ScoresheetView[];
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
	const sheetPlayersByMatch = new Map<string, SheetPlayer[]>();
	for (const p of state.matchSidePlayers) {
		const key = `${p.match_id}:${p.side}`;
		if (!playersByMatchSide.has(key)) playersByMatchSide.set(key, []);
		playersByMatchSide.get(key)!.push(p.name);
		if (!sheetPlayersByMatch.has(p.match_id)) sheetPlayersByMatch.set(p.match_id, []);
		sheetPlayersByMatch.get(p.match_id)!.push({
			id: p.id,
			side: p.side === 'B' ? 'B' : 'A',
			order: p.player_order,
			name: p.name
		});
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
			players: sheetPlayersByMatch.get(m.id) ?? [],
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

	// オーダー表: tie × side ごとに 1 行(提出のある側のみ)
	const lineupKeys: string[] = [];
	const lineupByKey = new Map<string, { status: string; pairs: Map<string, string> }>();
	for (const l of state.lineups) {
		const key = `${l.tie_id}:${l.side}`;
		if (!lineupByKey.has(key)) {
			lineupKeys.push(key);
			lineupByKey.set(key, { status: l.status, pairs: new Map() });
		}
		const pair = [l.player1_name, l.player2_name].filter(Boolean).join('・');
		lineupByKey.get(key)!.pairs.set(l.rubber_code, pair || '-');
	}
	const lineups: LineupSideView[] = lineupKeys
		.sort((a, b) => {
			const ta = tieById.get(a.split(':')[0]);
			const tb = tieById.get(b.split(':')[0]);
			return (ta?.display_order ?? 0) - (tb?.display_order ?? 0) || a.localeCompare(b);
		})
		.map((key) => {
			const [tieId, side] = key.split(':');
			const tie = tieById.get(tieId);
			if (!tie || tie.status === 'cancelled') return null;
			const entry = lineupByKey.get(key)!;
			const teamName = (side === 'A' ? tie.team_a_name : tie.team_b_name) ?? side;
			return {
				tieLabel: `${tie.tie_code} ${tie.team_a_name ?? '未定'} vs ${tie.team_b_name ?? '未定'}`,
				teamName,
				statusLabel: lineupStatusLabel(entry.status),
				pairCells: RUBBER_ORDER.map((code) => entry.pairs.get(code) ?? '-')
			};
		})
		.filter((v): v is LineupSideView => v !== null);

	// 紙スコアシート: 両チームのオーダーが提出済み(submitted/locked/revealed)の
	// 対戦について、終了していない試合を1枚ずつ出力する
	const SUBMITTED_LINEUP = new Set(['submitted', 'locked', 'revealed']);
	const TERMINAL_MATCH = new Set(['finished', 'confirmed', 'forfeited', 'retired', 'cancelled']);
	const lineupPairByTieSideRubber = new Map<string, [string, string]>();
	const lineupStatusByTieSide = new Map<string, string>();
	for (const l of state.lineups) {
		lineupStatusByTieSide.set(`${l.tie_id}:${l.side}`, l.status);
		lineupPairByTieSideRubber.set(`${l.tie_id}:${l.side}:${l.rubber_code}`, [
			l.player1_name ?? '',
			l.player2_name ?? ''
		]);
	}
	const jstTime = (iso: string | null): string | null =>
		iso
			? new Intl.DateTimeFormat('ja-JP', {
					timeZone: 'Asia/Tokyo',
					hour: '2-digit',
					minute: '2-digit'
				}).format(new Date(iso))
			: null;

	const scoresheets: ScoresheetView[] = [];
	for (const t of state.ties) {
		if (t.status === 'cancelled') continue;
		const statusA = lineupStatusByTieSide.get(`${t.id}:A`);
		const statusB = lineupStatusByTieSide.get(`${t.id}:B`);
		if (!statusA || !SUBMITTED_LINEUP.has(statusA)) continue;
		if (!statusB || !SUBMITTED_LINEUP.has(statusB)) continue;

		const tieRubbers = rubbersByTie.get(t.id) ?? [];
		for (const code of RUBBER_ORDER) {
			const rubber = tieRubbers.find((r) => r.code === code);
			if (!rubber || rubber.status === 'skipped' || rubber.winner_side) continue;
			const mv = rubber.match_id ? (matchViewById.get(rubber.match_id) ?? null) : null;
			if (mv && TERMINAL_MATCH.has(mv.match.status)) continue;

			const sidePair = (side: 'A' | 'B'): [string, string] => {
				const fromMatch = mv?.players.filter((p) => p.side === side) ?? [];
				if (fromMatch.length > 0) {
					return [fromMatch[0]?.name ?? '', fromMatch[1]?.name ?? ''];
				}
				return lineupPairByTieSideRubber.get(`${t.id}:${side}:${code}`) ?? ['', ''];
			};
			const gameScores: Array<{ a: number; b: number } | null> = [0, 1, 2].map((i) => {
				const g = mv?.games[i];
				return g && g.winnerSide ? { a: g.score.A, b: g.score.B } : null;
			});

			scoresheets.push({
				matchView: mv,
				matchNo: mv?.match.match_no ?? null,
				courtName: mv?.match.court_name ?? null,
				rubberCode: code,
				tieLabel: `${t.tie_code} ${t.team_a_name ?? '未定'} vs ${t.team_b_name ?? '未定'}`,
				roundLabel: t.round_label,
				teamAName: t.team_a_name ?? '',
				teamBName: t.team_b_name ?? '',
				namesA: sidePair('A'),
				namesB: sidePair('B'),
				gameScores,
				startAtJst: jstTime(mv?.match.actual_start_at ?? null)
			});
		}
	}

	return {
		state,
		generatedAtJst: formatJst(state.generatedAt),
		matches,
		courts,
		activeMatches,
		pendingMatches,
		finishedMatches,
		ties,
		lineups,
		scoresheets
	};
}
