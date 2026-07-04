#!/usr/bin/env node

/**
 * ステージング環境の機能テスト用シード。
 *
 * リーグ戦当日の途中(予選消化中)を再現する:
 *   - A/B 各リーグ 6 チーム総当たり(15 対戦 × 2)
 *   - 対戦 1-6: 承認済み / 7: 終了(承認待ち) / 8: 3勝打ち切り
 *   - 対戦 9: 進行中(終了2種目 + 試合中2種目 + 未開始1種目)
 *   - 対戦 10: 両チームオーダー提出済み / 11: 片側のみ提出 / 12-15: 提出待ち
 *   - 審判割当・オーダー・スナップショット付き試合データ
 *   - アカウント: testadmin / TestAdmin123、team01..team12 / TeamPass123、
 *     participant01 / Participant123
 *
 * Usage:
 *   npx tsx scripts/seed-staging-functional.ts [--db=todai-league-staging] [--base-url=https://...]
 *
 * 注意: 既存のリーグデータ(teams/ties/matches 等)は全削除される。auth 系は保持。
 */

import { execSync, type ExecSyncOptions } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	buildSeedScoreEvents,
	type SeedScoreEvent,
	type SeedService,
	type SeedSlot
} from '../src/lib/seed/scoreEventSeed';

const DB_NAME = process.argv.find((a) => a.startsWith('--db='))?.slice(5) ?? 'todai-league-staging';
const BASE_URL =
	process.argv.find((a) => a.startsWith('--base-url='))?.slice(11) ??
	'https://todai-league-staging.qwg2pfmvzk.workers.dev';

const ADMIN = { accountId: 'testadmin', password: 'TestAdmin123', name: 'Test Admin' };

const TOURNAMENT_ID = 'tokyo-league-default'; // INTERNAL_TOURNAMENT_ID
const GROUP_RULE_ID = 'GROUP_15'; // アプリは id = code 規約
const KNOCKOUT_RULE_ID = 'KNOCKOUT_21';
const TIEBREAKER_RULE_ID = 'TIEBREAKER_21_SINGLE_GAME';

const TEAM_DEFS = [
	// group A
	{ id: 'team-a1', name: '工学部', short: '工', group: 'A' },
	{ id: 'team-a2', name: '理学部', short: '理', group: 'A' },
	{ id: 'team-a3', name: '法学部', short: '法', group: 'A' },
	{ id: 'team-a4', name: '医学部', short: '医', group: 'A' },
	{ id: 'team-a5', name: '経済学部', short: '経', group: 'A' },
	{ id: 'team-a6', name: '文学部', short: '文', group: 'A' },
	// group B
	{ id: 'team-b1', name: '農学部', short: '農', group: 'B' },
	{ id: 'team-b2', name: '教育学部', short: '教', group: 'B' },
	{ id: 'team-b3', name: '薬学部', short: '薬', group: 'B' },
	{ id: 'team-b4', name: '教養学部', short: '養', group: 'B' },
	{ id: 'team-b5', name: '情報理工', short: '情', group: 'B' },
	{ id: 'team-b6', name: '数理科学', short: '数', group: 'B' }
] as const;

// 選手構成: 男子 M1..M7、女子 F1..F3(WD/XD/MD3種を重複なしで組める)
const MALE_COUNT = 7;
const FEMALE_COUNT = 3;

const RUBBERS = [
	{ code: 'WD1', discipline: 'WD', order: 1 },
	{ code: 'XD1', discipline: 'XD', order: 2 },
	{ code: 'MD3', discipline: 'MD', order: 3 },
	{ code: 'MD2', discipline: 'MD', order: 4 },
	{ code: 'MD1', discipline: 'MD', order: 5 }
] as const;

// rubber ごとの起用選手 (male index / female index は 1 始まり)
const LINEUP_PLAN: Record<string, { p1: string; p2: string }> = {
	WD1: { p1: 'F1', p2: 'F2' },
	XD1: { p1: 'F3', p2: 'M7' }, // XD は player1=女子, player2=男子
	MD3: { p1: 'M5', p2: 'M6' },
	MD2: { p1: 'M3', p2: 'M4' },
	MD1: { p1: 'M1', p2: 'M2' }
};

function esc(value: string): string {
	return value.replace(/'/g, "''");
}

function sqlStr(value: string | null): string {
	return value === null ? 'NULL' : `'${esc(value)}'`;
}

function playerId(teamId: string, slot: string): string {
	return `${teamId}-${slot.toLowerCase()}`;
}

function playerName(team: (typeof TEAM_DEFS)[number], slot: string): string {
	return `${team.short}${slot}`;
}

// 今日の日付ベースの時刻 (UTC ISO)
const BASE = new Date();
function at(hoursFromNow: number): string {
	return new Date(BASE.getTime() + hoursFromNow * 3600_000).toISOString();
}
const NOW = at(0);

// ── ゲームスコア生成 ─────────────────────────────────────────────────────────

type Game = { a: number; b: number };

/** 予選15点ルールで winner 側が勝つゲーム列を決定的に生成 */
function makeGames(winner: 'A' | 'B', seed: number): Game[] {
	const loserScores = [
		[8, 11],
		[12, 6],
		[10, 13],
		[7, 9],
		[13, 5],
		[11, 12]
	][seed % 6];
	const threeGames = seed % 3 === 0;
	const games: Game[] = [];
	const winGame = (loser: number): Game =>
		winner === 'A' ? { a: 15, b: loser } : { a: loser, b: 15 };
	const loseGame = (loser: number): Game =>
		winner === 'A' ? { a: loser, b: 15 } : { a: 15, b: loser };
	if (threeGames) {
		games.push(winGame(loserScores[0]), loseGame(loserScores[1]), winGame(9 + (seed % 5)));
	} else {
		games.push(winGame(loserScores[0]), winGame(loserScores[1]));
	}
	return games;
}

// ── SQL 生成 ────────────────────────────────────────────────────────────────

const lines: string[] = [];
let matchNo = 0;

function push(sql: string) {
	lines.push(sql);
}

function insertMatchWithState(params: {
	matchId: string;
	rubber: (typeof RUBBERS)[number];
	tieCode: string;
	roundLabel: string;
	teamA: (typeof TEAM_DEFS)[number];
	teamB: (typeof TEAM_DEFS)[number];
	// 'finished' | 'confirmed' | 'playing' | 'scheduled' | 'cancelled'
	status: string;
	games: Game[]; // playing の場合は最後の要素が進行中ゲーム
	startedAt: string | null;
	endedAt: string | null;
	seed: number;
}) {
	const { matchId, rubber, teamA, teamB, status, games } = params;
	matchNo += 1;

	const isTerminal = ['finished', 'confirmed', 'cancelled'].includes(status);
	const isPlaying = status === 'playing';
	const currentGameNo = games.length === 0 ? 1 : games.length;
	const current = games[games.length - 1] ?? { a: 0, b: 0 };
	const completedGames = isPlaying ? games.slice(0, -1) : games;
	const gamesWonA = completedGames.filter((g) => g.a > g.b).length;
	const gamesWonB = completedGames.filter((g) => g.b > g.a).length;
	const winnerSide =
		isTerminal && status !== 'cancelled' ? (gamesWonA > gamesWonB ? 'A' : 'B') : null;

	const plan = LINEUP_PLAN[rubber.code];

	// ライブページのスコア推移は score_events から構築されるため、
	// ゲームスコアと整合するラリー単位のイベント列も一緒に挿入する
	const scoreEvents =
		status === 'scheduled'
			? []
			: buildSeedScoreEvents(games, params.seed, { lastGameInProgress: isPlaying });

	// service state (playing のみ): 最終イベントのリプレイ結果と一致させる
	const lastService = scoreEvents[scoreEvents.length - 1]?.serviceAfter ?? null;
	const slotId = (slot: SeedSlot) => `msp-${matchId}-${slot[0]}-${slot[1]}`;
	const toServiceState = (svc: SeedService | null) => {
		if (!svc) return null;
		const otherCourt = svc.serviceCourt === 'right' ? 'left' : 'right';
		const partner = (slot: SeedSlot): SeedSlot =>
			`${slot[0]}${slot[1] === '1' ? '2' : '1'}` as SeedSlot;
		return {
			discipline: 'doubles',
			servingSide: svc.servingSide,
			serviceCourt: svc.serviceCourt,
			serverPlayerId: slotId(svc.serverSlot),
			receiverPlayerId: slotId(svc.receiverSlot),
			courtAssignments: {
				[svc.servingSide]: {
					[svc.serviceCourt]: slotId(svc.serverSlot),
					[otherCourt]: slotId(partner(svc.serverSlot))
				},
				[svc.servingSide === 'A' ? 'B' : 'A']: {
					[svc.serviceCourt]: slotId(svc.receiverSlot),
					[otherCourt]: slotId(partner(svc.receiverSlot))
				}
			},
			initialServerPlayerId: `msp-${matchId}-A-1`,
			initialReceiverPlayerId: `msp-${matchId}-B-1`
		};
	};
	const service = isPlaying ? toServiceState(lastService) : null;
	const serving = service?.servingSide ?? null;
	const serviceCourt = service?.serviceCourt ?? null;
	const serverPlayerId = service?.serverPlayerId ?? null;
	const receiverPlayerId = service?.receiverPlayerId ?? null;
	const courtAssignments = service?.courtAssignments ?? {};

	// snapshot state
	const lastSeqNo = scoreEvents.length === 0 ? 0 : scoreEvents[scoreEvents.length - 1].seqNo;
	const stateGames = games.map((g, i) => ({
		gameNo: i + 1,
		score: { A: g.a, B: g.b },
		winnerSide: isPlaying && i === games.length - 1 ? null : g.a > g.b ? 'A' : 'B',
		midGameIntervalTaken: Math.max(g.a, g.b) >= 8,
		changeEndsRequired: false,
		changeEndsCompleted: false
	}));
	if (stateGames.length === 0) {
		stateGames.push({
			gameNo: 1,
			score: { A: 0, B: 0 },
			winnerSide: null,
			midGameIntervalTaken: false,
			changeEndsRequired: false,
			changeEndsCompleted: false
		});
	}
	const state = {
		schemaVersion: 1,
		matchId,
		tournamentId: TOURNAMENT_ID,
		courtId: null,
		discipline: rubber.discipline,
		status,
		scoring: {
			maxGames: 3,
			gamesToWin: 2,
			pointsToWin: 15,
			winBy: 2,
			maxPoints: 21,
			midGameIntervalPoint: 8
		},
		currentGameNo,
		games: stateGames,
		gamesWon: { A: gamesWonA, B: gamesWonB },
		winnerSide,
		terminalReason: winnerSide ? 'normal' : status === 'cancelled' ? 'cancelled' : null,
		service,
		lastSeqNo,
		...(status === 'confirmed' ? { confirmedFromStatus: 'finished' } : {}),
		createdAt: params.startedAt ?? NOW,
		updatedAt: params.endedAt ?? NOW
	};

	push(
		`INSERT INTO matches (id, tournament_id, court_id, discipline, match_no, display_order, event_name, category, round_name, scoring_rule_id, status, current_game_no, current_score_a, current_score_b, games_won_a, games_won_b, winner_side, current_serving_side, current_service_court, current_server_player_id, current_receiver_player_id, last_seq_no, actual_start_at, actual_end_at, created_at, updated_at) VALUES ('${matchId}', '${TOURNAMENT_ID}', NULL, '${rubber.discipline}', ${matchNo}, ${matchNo}, '${esc(params.tieCode)}', '${esc(params.roundLabel)}', '${rubber.code}', '${GROUP_RULE_ID}', '${status}', ${currentGameNo}, ${current.a}, ${current.b}, ${gamesWonA}, ${gamesWonB}, ${sqlStr(winnerSide)}, ${sqlStr(isPlaying ? serving : null)}, ${sqlStr(isPlaying ? serviceCourt : null)}, ${sqlStr(isPlaying ? serverPlayerId : null)}, ${sqlStr(isPlaying ? receiverPlayerId : null)}, ${lastSeqNo}, ${sqlStr(params.startedAt)}, ${sqlStr(params.endedAt)}, '${NOW}', '${NOW}');`
	);

	// match_sides / players(matches の後に入れる: FK 順序)
	const sideDefs = [
		{ side: 'A', team: teamA },
		{ side: 'B', team: teamB }
	] as const;
	for (const { side, team } of sideDefs) {
		const msId = `ms-${matchId}-${side}`;
		const p1 = playerName(team, plan.p1);
		const p2 = playerName(team, plan.p2);
		push(
			`INSERT INTO match_sides (id, match_id, side, display_name, created_at, updated_at) VALUES ('${msId}', '${matchId}', '${side}', '${esc(`${p1} / ${p2}`)}', '${NOW}', '${NOW}');`
		);
		[plan.p1, plan.p2].forEach((slot, i) => {
			push(
				`INSERT INTO match_side_players (id, match_id, match_side_id, side, player_order, name, team_name, created_at, updated_at) VALUES ('msp-${matchId}-${side}-${i + 1}', '${matchId}', '${msId}', '${side}', ${i + 1}, '${esc(playerName(team, slot))}', '${esc(team.name)}', '${NOW}', '${NOW}');`
			);
		});
	}
	push(
		`INSERT INTO match_snapshots (match_id, seq_no, state_json, updated_at) VALUES ('${matchId}', ${lastSeqNo}, '${esc(JSON.stringify(state))}', '${NOW}');`
	);
	// Undo は「rally_won は直前イベントの afterState を beforeState として使う」
	// 前提なので、payload_json に各イベント時点の afterState を入れておく必要がある
	// (空 payload だと Undo target does not contain beforeState で失敗する)。
	const buildEventState = (ev: SeedScoreEvent) => {
		const evGames: typeof stateGames = [];
		for (let gameNo = 1; gameNo < ev.gameNo; gameNo++) {
			const g = games[gameNo - 1];
			evGames.push({
				gameNo,
				score: { A: g.a, B: g.b },
				winnerSide: g.a > g.b ? 'A' : 'B',
				midGameIntervalTaken: Math.max(g.a, g.b) >= 8,
				changeEndsRequired: false,
				changeEndsCompleted: false
			});
		}
		const target = games[ev.gameNo - 1] ?? { a: 0, b: 0 };
		const gameDone =
			ev.eventType === 'rally_won' &&
			ev.scoreAAfter === target.a &&
			ev.scoreBAfter === target.b &&
			!(isPlaying && ev.gameNo === games.length);
		evGames.push({
			gameNo: ev.gameNo,
			score: { A: ev.scoreAAfter, B: ev.scoreBAfter },
			winnerSide: gameDone ? (ev.scoreAAfter > ev.scoreBAfter ? 'A' : 'B') : null,
			midGameIntervalTaken: Math.max(ev.scoreAAfter, ev.scoreBAfter) >= 8,
			changeEndsRequired: false,
			changeEndsCompleted: false
		});
		return {
			...state,
			status: 'playing',
			currentGameNo: ev.gameNo,
			games: evGames,
			gamesWon: {
				A: evGames.filter((g) => g.winnerSide === 'A').length,
				B: evGames.filter((g) => g.winnerSide === 'B').length
			},
			winnerSide: null,
			terminalReason: null,
			confirmedFromStatus: undefined,
			service: toServiceState(ev.serviceAfter),
			lastSeqNo: ev.seqNo,
			createdAt: params.startedAt ?? NOW,
			updatedAt: params.startedAt ?? NOW
		};
	};
	let prevEventState: ReturnType<typeof buildEventState> | null = null;
	for (const ev of scoreEvents) {
		const afterState = buildEventState(ev);
		const payload = {
			afterState,
			// 本番の書き込み経路と同じく rally_won 以外は beforeState も保存する
			...(ev.eventType !== 'rally_won' && prevEventState ? { beforeState: prevEventState } : {})
		};
		prevEventState = afterState;
		const sb = ev.serviceBefore;
		const sa = ev.serviceAfter;
		push(
			`INSERT INTO score_events (id, match_id, seq_no, event_type, side, game_no, score_a_before, score_b_before, score_a_after, score_b_after, serving_side_before, service_court_before, server_player_id_before, receiver_player_id_before, serving_side_after, service_court_after, server_player_id_after, receiver_player_id_after, idempotency_key, payload_json, created_at) VALUES ('se-${matchId}-${ev.seqNo}', '${matchId}', ${ev.seqNo}, '${ev.eventType}', ${sqlStr(ev.side)}, ${ev.gameNo}, ${ev.scoreABefore}, ${ev.scoreBBefore}, ${ev.scoreAAfter}, ${ev.scoreBAfter}, ${sqlStr(sb?.servingSide ?? null)}, ${sqlStr(sb?.serviceCourt ?? null)}, ${sqlStr(sb ? slotId(sb.serverSlot) : null)}, ${sqlStr(sb ? slotId(sb.receiverSlot) : null)}, ${sqlStr(sa?.servingSide ?? null)}, ${sqlStr(sa?.serviceCourt ?? null)}, ${sqlStr(sa ? slotId(sa.serverSlot) : null)}, ${sqlStr(sa ? slotId(sa.receiverSlot) : null)}, 'seed-${matchId}-${ev.seqNo}', '${esc(JSON.stringify(payload))}', '${params.startedAt ?? NOW}');`
		);
	}
	push(
		`INSERT INTO match_service_states (match_id, game_no, serving_side, service_court, server_player_id, receiver_player_id, court_assignments_json, updated_at) VALUES ('${matchId}', ${currentGameNo}, ${sqlStr(isPlaying ? serving : null)}, ${sqlStr(isPlaying ? serviceCourt : null)}, ${sqlStr(isPlaying ? serverPlayerId : null)}, ${sqlStr(isPlaying ? receiverPlayerId : null)}, '${esc(JSON.stringify(isPlaying ? courtAssignments : {}))}', '${NOW}');`
	);
}

function buildSql(): string {
	// D1 は同一リクエスト内で FK 検証を先送りできる
	push('PRAGMA defer_foreign_keys = true;');

	// 旧チームを参照しているアカウントプロファイルを先に外す(後で ensureAccounts が張り直す)
	push(`UPDATE auth_user_profiles SET team_id = NULL WHERE team_id IS NOT NULL;`);

	// 既存リーグデータの全削除(auth 系は保持)
	for (const table of [
		'lineup_items',
		'lineup_submissions',
		'score_event_undo_links',
		'score_events',
		'match_service_states',
		'match_snapshots',
		'match_side_players',
		'match_sides',
		'officiating_assignments',
		'rubbers',
		'matches',
		'ties',
		'ranking_tiebreakers',
		'group_standing_overrides',
		'team_players',
		'teams',
		'app_settings',
		'scoring_rules'
	]) {
		push(`DELETE FROM ${table};`);
	}

	// 得点ルール・設定・内部トーナメント
	push(
		`INSERT INTO scoring_rules (id, code, name, max_games, games_to_win, points_to_win, win_by, max_points, mid_game_interval_point, created_at, updated_at) VALUES ('${GROUP_RULE_ID}', 'GROUP_15', '予選用15点ルール', 3, 2, 15, 2, 21, 8, '${NOW}', '${NOW}');`
	);
	push(
		`INSERT INTO scoring_rules (id, code, name, max_games, games_to_win, points_to_win, win_by, max_points, mid_game_interval_point, created_at, updated_at) VALUES ('${KNOCKOUT_RULE_ID}', 'KNOCKOUT_21', '決勝トーナメント21点ルール', 3, 2, 21, 2, 30, 11, '${NOW}', '${NOW}');`
	);
	push(
		`INSERT INTO scoring_rules (id, code, name, max_games, games_to_win, points_to_win, win_by, max_points, mid_game_interval_point, created_at, updated_at) VALUES ('${TIEBREAKER_RULE_ID}', 'TIEBREAKER_21_SINGLE_GAME', '順位決定再試合用21点1ゲームマッチ', 1, 1, 21, 2, 30, 11, '${NOW}', '${NOW}');`
	);
	push(
		`INSERT INTO app_settings (id, event_name, group_stage_scoring_rule_id, knockout_scoring_rule_id, tiebreaker_scoring_rule_id, lineup_reveal_policy, default_lineup_due_minutes_before, created_at, updated_at) VALUES ('default', '東大リーグ団体戦(ステージング)', '${GROUP_RULE_ID}', '${KNOCKOUT_RULE_ID}', '${TIEBREAKER_RULE_ID}', 'on_tie_start', 10, '${NOW}', '${NOW}');`
	);
	push(
		`INSERT OR IGNORE INTO tournaments (id, name, status, created_at, updated_at) VALUES ('${TOURNAMENT_ID}', '東大リーグ団体戦(ステージング)', 'running', '${NOW}', '${NOW}');`
	);
	push(
		`UPDATE tournaments SET name = '東大リーグ団体戦(ステージング)', status = 'running' WHERE id = '${TOURNAMENT_ID}';`
	);

	// チームと選手
	TEAM_DEFS.forEach((team, ti) => {
		push(
			`INSERT INTO teams (id, name, short_name, group_code, display_order, status, created_at, updated_at) VALUES ('${team.id}', '${esc(team.name)}', '${esc(team.short)}', '${team.group}', ${ti + 1}, 'active', '${NOW}', '${NOW}');`
		);
		let order = 0;
		for (let m = 1; m <= MALE_COUNT; m++) {
			order += 1;
			push(
				`INSERT INTO team_players (id, team_id, name, gender, display_order, status, created_at, updated_at) VALUES ('${playerId(team.id, `M${m}`)}', '${team.id}', '${esc(playerName(team, `M${m}`))}', 'male', ${order}, 'active', '${NOW}', '${NOW}');`
			);
		}
		for (let f = 1; f <= FEMALE_COUNT; f++) {
			order += 1;
			push(
				`INSERT INTO team_players (id, team_id, name, gender, display_order, status, created_at, updated_at) VALUES ('${playerId(team.id, `F${f}`)}', '${team.id}', '${esc(playerName(team, `F${f}`))}', 'female', ${order}, 'active', '${NOW}', '${NOW}');`
			);
		}
	});

	// リーグごとの総当たり対戦
	for (const group of ['A', 'B'] as const) {
		const groupTeams = TEAM_DEFS.filter((t) => t.group === group);
		const courtBlocks = group === 'A' ? ['first_1_3', 'first_4_6'] : ['second_2_4', 'second_6_8'];
		const venue = group === 'A' ? 'first_gym' : 'second_gym';

		const pairs: Array<[(typeof TEAM_DEFS)[number], (typeof TEAM_DEFS)[number]]> = [];
		for (let i = 0; i < groupTeams.length; i++) {
			for (let j = i + 1; j < groupTeams.length; j++) {
				pairs.push([groupTeams[i], groupTeams[j]]);
			}
		}

		pairs.forEach(([teamA, teamB], pi) => {
			const n = pi + 1;
			const tieId = `tie-${group.toLowerCase()}${String(n).padStart(2, '0')}`;
			const tieCode = `${group}-${n}`;
			const roundLabel = `${group}リーグ`;
			const seed = pi + (group === 'A' ? 0 : 7);

			// 対戦の進行状態を index で決める
			// 1-6: confirmed / 7: finished / 8: cutoff(finished) / 9: playing /
			// 10: 両者提出 / 11: 片側提出 / 12-15: 提出待ち
			type TieState =
				| 'confirmed'
				| 'finished'
				| 'cutoff'
				| 'playing'
				| 'both_submitted'
				| 'one_submitted'
				| 'pending';
			const tieState: TieState =
				n <= 6
					? 'confirmed'
					: n === 7
						? 'finished'
						: n === 8
							? 'cutoff'
							: n === 9
								? 'playing'
								: n === 10
									? 'both_submitted'
									: n === 11
										? 'one_submitted'
										: 'pending';

			const scheduledAt = at(-6 + pi * 0.75);
			const lineupDueAt = at(-6 + pi * 0.75 - 1 / 6);
			const done = ['confirmed', 'finished', 'cutoff'].includes(tieState);
			const revealed = done || tieState === 'playing';

			// rubbers の勝敗プラン
			// seed によって 3-0 / 3-1 / 3-2 を変える
			const winnerPlanList: Array<Array<'A' | 'B'>> = [
				['A', 'A', 'A', 'B', 'B'], // 3-2
				['A', 'B', 'A', 'A', 'B'], // 3-2
				['B', 'B', 'A', 'B', 'A'], // B 3-2
				['A', 'A', 'B', 'A', 'B'], // 3-2 → adjusted below
				['A', 'A', 'A', 'A', 'B'], // 4-1
				['B', 'A', 'B', 'B', 'B'] // B 4-1
			];
			const winners = winnerPlanList[seed % winnerPlanList.length];

			let teamScoreA = 0;
			let teamScoreB = 0;
			let tieStatus: string;
			let winnerTeamId: string | null = null;
			let actualStartAt: string | null = null;
			let actualEndAt: string | null = null;

			const rubberRows: Array<{
				rubberId: string;
				code: string;
				status: string;
				winnerSide: string | null;
				matchId: string | null;
			}> = [];

			if (done || tieState === 'playing') {
				actualStartAt = scheduledAt;
			}

			RUBBERS.forEach((rubber, ri) => {
				const rubberId = `rubber-${tieId}-${rubber.code.toLowerCase()}`;
				const matchId = `match-${tieId}-${rubber.code.toLowerCase()}`;
				const winner = winners[ri];

				if (tieState === 'confirmed' || tieState === 'finished') {
					const games = makeGames(winner, seed + ri);
					const matchStatus = tieState === 'confirmed' ? 'confirmed' : 'finished';
					insertMatchWithState({
						matchId,
						rubber,
						tieCode,
						roundLabel,
						teamA,
						teamB,
						status: matchStatus,
						games,
						startedAt: at(-6 + pi * 0.75 + ri * 0.1),
						endedAt: at(-6 + pi * 0.75 + ri * 0.1 + 0.4),
						seed: seed + ri
					});
					if (winner === 'A') teamScoreA += 1;
					else teamScoreB += 1;
					rubberRows.push({
						rubberId,
						code: rubber.code,
						status: matchStatus === 'confirmed' ? 'confirmed' : 'finished',
						winnerSide: winner,
						matchId
					});
				} else if (tieState === 'cutoff') {
					// 最初の3種目を A が取り、残り2種目は打ち切り
					if (ri < 3) {
						const games = makeGames('A', seed + ri);
						insertMatchWithState({
							matchId,
							rubber,
							tieCode,
							roundLabel,
							teamA,
							teamB,
							status: 'finished',
							games,
							startedAt: at(-6 + pi * 0.75 + ri * 0.1),
							endedAt: at(-6 + pi * 0.75 + ri * 0.1 + 0.4),
							seed: seed + ri
						});
						teamScoreA += 1;
						rubberRows.push({
							rubberId,
							code: rubber.code,
							status: 'finished',
							winnerSide: 'A',
							matchId
						});
					} else {
						insertMatchWithState({
							matchId,
							rubber,
							tieCode,
							roundLabel,
							teamA,
							teamB,
							status: 'cancelled',
							games: [],
							startedAt: null,
							endedAt: null,
							seed: seed + ri
						});
						rubberRows.push({
							rubberId,
							code: rubber.code,
							status: 'cancelled',
							winnerSide: null,
							matchId
						});
					}
				} else if (tieState === 'playing') {
					if (ri < 2) {
						// 終了済み種目 (WD1: A 勝ち, XD1: B 勝ち)
						const winnerSide = ri === 0 ? 'A' : 'B';
						const games = makeGames(winnerSide, seed + ri);
						insertMatchWithState({
							matchId,
							rubber,
							tieCode,
							roundLabel,
							teamA,
							teamB,
							status: 'confirmed',
							games,
							startedAt: at(-1.5 + ri * 0.2),
							endedAt: at(-1 + ri * 0.2),
							seed: seed + ri
						});
						if (winnerSide === 'A') teamScoreA += 1;
						else teamScoreB += 1;
						rubberRows.push({
							rubberId,
							code: rubber.code,
							status: 'confirmed',
							winnerSide,
							matchId
						});
					} else if (ri < 4) {
						// 進行中種目: MD3 は第2ゲーム、MD2 は第1ゲーム
						const games: Game[] =
							ri === 2
								? [
										{ a: 15, b: 11 },
										{ a: 9, b: 7 }
									]
								: [{ a: 5, b: 8 }];
						insertMatchWithState({
							matchId,
							rubber,
							tieCode,
							roundLabel,
							teamA,
							teamB,
							status: 'playing',
							games,
							startedAt: at(-0.5),
							endedAt: null,
							seed: seed + ri
						});
						rubberRows.push({
							rubberId,
							code: rubber.code,
							status: 'playing',
							winnerSide: null,
							matchId
						});
					} else {
						// 未開始種目
						insertMatchWithState({
							matchId,
							rubber,
							tieCode,
							roundLabel,
							teamA,
							teamB,
							status: 'scheduled',
							games: [],
							startedAt: null,
							endedAt: null,
							seed: seed + ri
						});
						rubberRows.push({
							rubberId,
							code: rubber.code,
							status: 'scheduled',
							winnerSide: null,
							matchId
						});
					}
				} else {
					// 未開始対戦: match なし
					rubberRows.push({
						rubberId,
						code: rubber.code,
						status: 'not_ready',
						winnerSide: null,
						matchId: null
					});
				}
			});

			if (done) {
				tieStatus = tieState === 'confirmed' ? 'confirmed' : 'finished';
				winnerTeamId = teamScoreA >= 3 ? teamA.id : teamB.id;
				actualEndAt = at(-6 + pi * 0.75 + 0.9);
			} else if (tieState === 'playing') {
				tieStatus = 'playing';
			} else if (tieState === 'both_submitted') {
				tieStatus = 'lineup_submitted';
			} else {
				tieStatus = 'lineup_pending';
			}

			const futureScheduledAt = ['both_submitted', 'one_submitted', 'pending'].includes(tieState)
				? at(1 + (n - 10) * 0.75)
				: scheduledAt;
			const futureDueAt = ['both_submitted', 'one_submitted', 'pending'].includes(tieState)
				? at(1 + (n - 10) * 0.75 - 1 / 6)
				: lineupDueAt;

			push(
				`INSERT INTO ties (id, tie_code, phase, group_code, round_label, team_a_id, team_b_id, status, team_score_a, team_score_b, winner_team_id, display_order, scheduled_start_at, actual_start_at, actual_end_at, venue, court_block_code, lineup_due_at, lineup_due_policy, lineups_revealed_at, created_at, updated_at) VALUES ('${tieId}', '${tieCode}', 'group_${group.toLowerCase()}', '${group}', '${esc(roundLabel)}', '${teamA.id}', '${teamB.id}', '${tieStatus}', ${teamScoreA}, ${teamScoreB}, ${sqlStr(winnerTeamId)}, ${n}, '${futureScheduledAt}', ${sqlStr(actualStartAt)}, ${sqlStr(actualEndAt)}, '${venue}', '${courtBlocks[pi % courtBlocks.length]}', '${futureDueAt}', 'ten_minutes_before', ${sqlStr(revealed ? actualStartAt : null)}, '${NOW}', '${NOW}');`
			);

			for (const row of rubberRows) {
				const rubber = RUBBERS.find((r) => r.code === row.code)!;
				push(
					`INSERT INTO rubbers (id, tie_id, code, discipline, display_order, scoring_rule_id, match_id, status, winner_side, created_at, updated_at) VALUES ('${row.rubberId}', '${tieId}', '${row.code}', '${rubber.discipline}', ${rubber.order}, '${GROUP_RULE_ID}', ${sqlStr(row.matchId)}, '${row.status}', ${sqlStr(row.winnerSide)}, '${NOW}', '${NOW}');`
				);
				if (row.matchId) {
					push(`UPDATE matches SET rubber_id = '${row.rubberId}' WHERE id = '${row.matchId}';`);
				}
			}

			// lineup submissions
			const sides = [
				{ side: 'A', team: teamA },
				{ side: 'B', team: teamB }
			] as const;
			for (const { side, team } of sides) {
				const skip = tieState === 'pending' || (tieState === 'one_submitted' && side === 'B');
				if (skip) continue;
				const submissionStatus = revealed
					? 'revealed'
					: tieState === 'both_submitted' || tieState === 'one_submitted'
						? 'submitted'
						: 'draft';
				const lsId = `ls-${tieId}-${side.toLowerCase()}`;
				push(
					`INSERT INTO lineup_submissions (id, tie_id, team_id, side, status, submitted_at, locked_at, revealed_at, created_at, updated_at) VALUES ('${lsId}', '${tieId}', '${team.id}', '${side}', '${submissionStatus}', '${NOW}', ${sqlStr(revealed ? NOW : null)}, ${sqlStr(revealed ? NOW : null)}, '${NOW}', '${NOW}');`
				);
				for (const rubber of RUBBERS) {
					const plan = LINEUP_PLAN[rubber.code];
					push(
						`INSERT INTO lineup_items (id, submission_id, rubber_code, player1_id, player2_id, created_at, updated_at) VALUES ('li-${lsId}-${rubber.code}', '${lsId}', '${rubber.code}', '${playerId(team.id, plan.p1)}', '${playerId(team.id, plan.p2)}', '${NOW}', '${NOW}');`
					);
				}
			}

			// 審判割当: 進行中〜提出待ちの対戦に、対戦していないチームを割り当てる
			if (['playing', 'both_submitted', 'one_submitted', 'pending'].includes(tieState)) {
				const umpireTeam = groupTeams.find((t) => t.id !== teamA.id && t.id !== teamB.id)!;
				push(
					`INSERT INTO officiating_assignments (id, tie_id, assigned_team_id, role, status, created_at, updated_at) VALUES ('oa-${tieId}', '${tieId}', '${umpireTeam.id}', 'umpire_team', 'scheduled', '${NOW}', '${NOW}');`
				);
			}
		});
	}

	return lines.join('\n');
}

// ── アカウント作成 ──────────────────────────────────────────────────────────

function d1(sql: string) {
	const cmd = `npx wrangler d1 execute ${DB_NAME} -c wrangler.staging.jsonc --remote --command="${sql.replace(/"/g, '\\"')}"`;
	execSync(cmd, { stdio: 'pipe', timeout: 120_000 } satisfies ExecSyncOptions);
}

async function signUp(accountId: string, password: string, name: string): Promise<void> {
	let res: Response;
	for (;;) {
		res = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
			body: JSON.stringify({
				email: `${accountId}@accounts.local`,
				password,
				name,
				username: accountId,
				data: { displayUsername: accountId }
			})
		});
		if (res.status !== 429) break;
		const waitSec = Number(res.headers.get('retry-after') ?? '30') + 1;
		console.log(`[SEED] rate limited, waiting ${waitSec}s...`);
		await new Promise((r) => setTimeout(r, waitSec * 1000));
	}
	const body = (await res.json().catch(() => null)) as { code?: string } | null;
	if (res.ok) {
		console.log(`[SEED] account created: ${accountId}`);
	} else if (body?.code === 'USERNAME_IS_ALREADY_TAKEN' || body?.code === 'EMAIL_ALREADY_EXISTS') {
		console.log(`[SEED] account exists: ${accountId}`);
	} else {
		throw new Error(`sign-up failed for ${accountId}: ${JSON.stringify(body)}`);
	}
}

async function ensureAccounts(): Promise<void> {
	// admin
	await signUp(ADMIN.accountId, ADMIN.password, ADMIN.name);
	d1(`UPDATE user SET role = 'admin' WHERE username = '${ADMIN.accountId}';`);
	d1(
		`INSERT OR REPLACE INTO auth_user_profiles (user_id, account_type, team_id, display_name, created_at, updated_at) SELECT id, 'admin', NULL, '${ADMIN.name}', datetime('now'), datetime('now') FROM user WHERE username = '${ADMIN.accountId}';`
	);

	// team accounts: team01..team12 → TEAM_DEFS 順
	for (let i = 0; i < TEAM_DEFS.length; i++) {
		const team = TEAM_DEFS[i];
		const accountId = `team${String(i + 1).padStart(2, '0')}`;
		await signUp(accountId, 'TeamPass123', `${team.name}アカウント`);
		d1(
			`INSERT OR REPLACE INTO auth_user_profiles (user_id, account_type, team_id, display_name, created_at, updated_at) SELECT id, 'team', '${team.id}', '${team.name}', datetime('now'), datetime('now') FROM user WHERE username = '${accountId}';`
		);
	}

	// 一般参加者
	await signUp('participant01', 'Participant123', '一般参加者');
	d1(
		`INSERT OR REPLACE INTO auth_user_profiles (user_id, account_type, team_id, display_name, created_at, updated_at) SELECT id, 'participant', NULL, '一般参加者', datetime('now'), datetime('now') FROM user WHERE username = 'participant01';`
	);
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
	if (process.argv.includes('--sql-only')) {
		const sql = buildSql();
		const sqlFile = resolve('/tmp/seed-staging-functional.sql');
		writeFileSync(sqlFile, sql, 'utf-8');
		console.log(`[SEED] wrote ${lines.length} statements to ${sqlFile}`);
		return;
	}

	console.log(`[SEED] DB: ${DB_NAME}, Base URL: ${BASE_URL}`);

	console.log('[SEED] applying migrations...');
	try {
		execSync(`npx wrangler d1 migrations apply ${DB_NAME} -c wrangler.staging.jsonc --remote`, {
			stdio: 'inherit',
			timeout: 180_000
		} satisfies ExecSyncOptions);
	} catch {
		console.log('[SEED] migrations may already be applied, continuing...');
	}

	console.log('[SEED] building seed SQL...');
	const sql = buildSql();
	const sqlFile = resolve('/tmp/seed-staging-functional.sql');
	writeFileSync(sqlFile, sql, 'utf-8');
	console.log(`[SEED] executing ${lines.length} statements...`);
	execSync(
		`npx wrangler d1 execute ${DB_NAME} -c wrangler.staging.jsonc --remote --file="${sqlFile}"`,
		{
			stdio: 'inherit',
			timeout: 600_000
		} satisfies ExecSyncOptions
	);

	console.log('[SEED] ensuring accounts...');
	await ensureAccounts();

	console.log('[SEED] done!');
	console.log('  admin:       testadmin / TestAdmin123');
	console.log('  teams:       team01..team12 / TeamPass123 (team01=工学部 ... team12=数理科学)');
	console.log('  participant: participant01 / Participant123');
}

main().catch((e) => {
	console.error('[SEED] fatal:', e);
	process.exit(1);
});
