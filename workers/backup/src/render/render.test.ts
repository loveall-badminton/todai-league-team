import { describe, expect, it } from 'vitest';
import type { BackupState } from '../types';
import { renderScoresCsv } from './csv';
import { renderEmergencyHtml } from './html';
import { renderEmergencyMarkdown } from './markdown';
import { renderEventLogNdjson } from './ndjson';
import { buildEmergencyView, toSafeTimestamp } from './view';

function fixtureState(): BackupState {
	return {
		generatedAt: '2026-07-02T04:05:00.000Z', // 13:05 JST
		tournamentId: 'tournament-2026',
		tournamentName: '東京大学リーグ 2026',
		lastEventId: 1842,
		teams: [
			{
				id: 'team-a',
				name: 'A大学',
				short_name: 'A',
				group_code: 'A',
				status: 'active',
				display_order: 1
			},
			{
				id: 'team-b',
				name: 'B大学',
				short_name: 'B',
				group_code: 'A',
				status: 'active',
				display_order: 2
			}
		],
		ties: [
			{
				id: 'tie-1',
				tie_code: 'A1',
				phase: 'group_a',
				group_code: 'A',
				round_label: null,
				status: 'playing',
				team_score_a: 1,
				team_score_b: 0,
				winner_team_id: null,
				display_order: 1,
				scheduled_start_at: null,
				venue: null,
				court_block_code: null,
				operation_note: null,
				team_a_id: 'team-a',
				team_b_id: 'team-b',
				team_a_name: 'A大学',
				team_b_name: 'B大学'
			}
		],
		rubbers: [
			{
				id: 'rubber-wd1',
				tie_id: 'tie-1',
				code: 'WD1',
				discipline: 'WD',
				display_order: 1,
				match_id: 'match-1',
				status: 'finished',
				winner_side: 'A'
			},
			{
				id: 'rubber-xd1',
				tie_id: 'tie-1',
				code: 'XD1',
				discipline: 'XD',
				display_order: 2,
				match_id: 'match-2',
				status: 'playing',
				winner_side: null
			},
			{
				id: 'rubber-md3',
				tie_id: 'tie-1',
				code: 'MD3',
				discipline: 'MD',
				display_order: 3,
				match_id: 'match-3',
				status: 'ready',
				winner_side: null
			}
		],
		courts: [
			{ id: 'court-1', name: '1', display_order: 1, status: 'active' },
			{ id: 'court-2', name: '2', display_order: 2, status: 'active' }
		],
		matches: [
			{
				id: 'match-1',
				court_id: 'court-1',
				court_name: '1',
				discipline: 'WD',
				status: 'finished',
				current_game_no: 2,
				current_score_a: 21,
				current_score_b: 15,
				games_won_a: 2,
				games_won_b: 0,
				winner_side: 'A',
				current_serving_side: null,
				last_seq_no: 80,
				rubber_id: 'rubber-wd1',
				match_no: 1,
				display_order: 1,
				event_name: null,
				round_name: null,
				scheduled_start_at: null,
				actual_start_at: null,
				actual_end_at: null
			},
			{
				id: 'match-2',
				court_id: 'court-1',
				court_name: '1',
				discipline: 'XD',
				status: 'playing',
				current_game_no: 2,
				current_score_a: 11,
				current_score_b: 9,
				games_won_a: 1,
				games_won_b: 0,
				winner_side: null,
				current_serving_side: 'A',
				last_seq_no: 55,
				rubber_id: 'rubber-xd1',
				match_no: 2,
				display_order: 2,
				event_name: null,
				round_name: null,
				scheduled_start_at: null,
				actual_start_at: null,
				actual_end_at: null
			},
			{
				id: 'match-3',
				court_id: null,
				court_name: null,
				discipline: 'MD',
				status: 'scheduled',
				current_game_no: 1,
				current_score_a: 0,
				current_score_b: 0,
				games_won_a: 0,
				games_won_b: 0,
				winner_side: null,
				current_serving_side: null,
				last_seq_no: 0,
				rubber_id: 'rubber-md3',
				match_no: 3,
				display_order: 3,
				event_name: null,
				round_name: null,
				scheduled_start_at: null,
				actual_start_at: null,
				actual_end_at: null
			}
		],
		matchSides: [
			{ match_id: 'match-2', side: 'A', display_name: 'A大学' },
			{ match_id: 'match-2', side: 'B', display_name: 'B大学' }
		],
		matchSidePlayers: [
			{
				id: 'p-a1',
				match_id: 'match-2',
				side: 'A',
				player_order: 1,
				name: 'A1',
				team_name: 'A大学'
			},
			{
				id: 'p-a2',
				match_id: 'match-2',
				side: 'A',
				player_order: 2,
				name: 'A2',
				team_name: 'A大学'
			},
			{
				id: 'p-b1',
				match_id: 'match-2',
				side: 'B',
				player_order: 1,
				name: 'B1',
				team_name: 'B大学'
			},
			{
				id: 'p-b2',
				match_id: 'match-2',
				side: 'B',
				player_order: 2,
				name: 'B2',
				team_name: 'B大学'
			}
		],
		matchSnapshots: [
			{
				match_id: 'match-2',
				state_json: JSON.stringify({
					games: [
						{ gameNo: 1, score: { A: 21, B: 18 }, winnerSide: 'A' },
						{ gameNo: 2, score: { A: 11, B: 9 }, winnerSide: null }
					]
				})
			}
		],
		lineups: [
			{
				tie_id: 'tie-1',
				side: 'A',
				status: 'revealed',
				rubber_code: 'WD1',
				player1_name: 'A1',
				player2_name: 'A2'
			},
			{
				tie_id: 'tie-1',
				side: 'A',
				status: 'revealed',
				rubber_code: 'XD1',
				player1_name: 'A1',
				player2_name: 'A2'
			},
			{
				tie_id: 'tie-1',
				side: 'A',
				status: 'revealed',
				rubber_code: 'MD3',
				player1_name: 'A3',
				player2_name: 'A4'
			},
			{
				tie_id: 'tie-1',
				side: 'B',
				status: 'submitted',
				rubber_code: 'WD1',
				player1_name: 'B1',
				player2_name: 'B2'
			},
			{
				tie_id: 'tie-1',
				side: 'B',
				status: 'submitted',
				rubber_code: 'XD1',
				player1_name: 'B1',
				player2_name: 'B2'
			},
			{
				tie_id: 'tie-1',
				side: 'B',
				status: 'submitted',
				rubber_code: 'MD3',
				player1_name: 'B3',
				player2_name: 'B4'
			}
		],
		scoreEvents: [
			{
				match_id: 'match-2',
				seq_no: 1,
				event_type: 'match_started',
				side: null,
				game_no: 1,
				score_a_after: 0,
				score_b_after: 0,
				server_player_id_before: null,
				server_player_id_after: 'p-a1',
				receiver_player_id_before: null,
				receiver_player_id_after: 'p-b1',
				target_seq_no: null
			},
			{
				match_id: 'match-2',
				seq_no: 2,
				event_type: 'rally_won',
				side: 'A',
				game_no: 1,
				score_a_after: 1,
				score_b_after: 0,
				server_player_id_before: 'p-a1',
				server_player_id_after: 'p-a1',
				receiver_player_id_before: 'p-b1',
				receiver_player_id_after: 'p-b2',
				target_seq_no: null
			},
			{
				match_id: 'match-2',
				seq_no: 3,
				event_type: 'rally_won',
				side: 'B',
				game_no: 1,
				score_a_after: 1,
				score_b_after: 1,
				server_player_id_before: 'p-a1',
				server_player_id_after: 'p-b2',
				receiver_player_id_before: 'p-b2',
				receiver_player_id_after: 'p-a1',
				target_seq_no: null
			}
		],
		recentEvents: [
			{
				global_id: 1842,
				id: 'ev-1842',
				match_id: 'match-2',
				seq_no: 55,
				event_type: 'rally_won',
				side: 'A',
				game_no: 2,
				score_a_after: 11,
				score_b_after: 9,
				actor_name: null,
				created_at: '2026-07-02 04:04:00'
			}
		]
	};
}

describe('toSafeTimestamp', () => {
	it('JSTのパス安全なタイムスタンプに変換する', () => {
		expect(toSafeTimestamp('2026-07-02T04:05:00.000Z')).toBe('2026-07-02T13-05-00+09-00');
	});
});

describe('buildEmergencyView', () => {
	it('コート・団体戦・未実施試合を集計する', () => {
		const view = buildEmergencyView(fixtureState());

		expect(view.courts).toHaveLength(2);
		expect(view.courts[0].current?.match.id).toBe('match-2');
		expect(view.courts[1].current).toBeNull();

		expect(view.activeMatches.map((m) => m.match.id)).toEqual(['match-2']);
		expect(view.pendingMatches.map((m) => m.match.id)).toEqual(['match-3']);
		expect(view.finishedMatches.map((m) => m.match.id)).toEqual(['match-1']);

		const tie = view.ties[0];
		expect(tie.rubberCells[0]).toContain('○A大学'); // WD1
		expect(tie.rubberCells[1]).toContain('進行中'); // XD1
		expect(tie.rubberCells[2]).toBe('未実施'); // MD3
		expect(tie.resultLabel).toContain('1-0');

		// match_snapshots からゲームスコアを復元する
		expect(view.courts[0].current?.gamesLabel).toBe('21-18, 11-9');
	});

	it('オーダーを tie × side ごとに集計する', () => {
		const view = buildEmergencyView(fixtureState());
		expect(view.lineups).toHaveLength(2);
		expect(view.lineups[0].teamName).toBe('A大学');
		expect(view.lineups[0].statusLabel).toBe('公開済');
		expect(view.lineups[0].pairCells).toEqual(['A1・A2', 'A1・A2', 'A3・A4', '-', '-']);
		expect(view.lineups[1].teamName).toBe('B大学');
		expect(view.lineups[1].statusLabel).toBe('提出済');
	});

	it('オーダー提出済みかつ未終了の試合だけ紙スコアシート対象にする', () => {
		const view = buildEmergencyView(fixtureState());

		expect(view.scoresheets).toHaveLength(2);
		expect(view.scoresheets.map((sheet) => sheet.rubberCode)).toEqual(['XD1', 'MD3']);
		expect(view.scoresheets[0].namesA).toEqual(['A1', 'A2']);
		expect(view.scoresheets[1].namesB).toEqual(['B3', 'B4']);
	});
});

describe('renderEmergencyHtml', () => {
	it('必須セクションと紙スコアシートを含む', () => {
		const html = renderEmergencyHtml(buildEmergencyView(fixtureState()));

		expect(html).toContain('緊急運営継続パケット');
		expect(html).toContain('東京大学リーグ 2026');
		expect(html).toContain('障害時の運営手順');
		expect(html).toContain('コート別進行状況');
		expect(html).toContain('団体戦別勝敗状況');
		expect(html).toContain('未実施試合');
		expect(html).toContain('オーダー表');
		expect(html).toContain('A1・A2');
		expect(html).toContain('復旧後の再入力手順');
		expect(html).toContain('バドミントン・ダブルス用スコアシート');
		expect(html).toContain('試合番号');
		expect(html).toContain('主審署名');
		expect(html).toContain('結果確認');
		expect(html).toContain('第1ゲーム');
		expect(html).toContain('A3');
		expect(html).toContain('B4');
		expect(html).toContain('sheet-grid');
		expect(html).toContain('service-over');
		expect(html).toContain('A1/A2 vs B1/B2');
		expect(html).toContain('@page');
	});
});

describe('renderEmergencyMarkdown', () => {
	it('進行状況と手順を含む', () => {
		const md = renderEmergencyMarkdown(buildEmergencyView(fixtureState()));
		expect(md).toContain('# 緊急運営継続パケット');
		expect(md).toContain('最終イベント番号: 1842');
		expect(md).toContain('| WD1 | XD1 | MD3 | MD2 | MD1 |');
		expect(md).toContain('## 障害時の運営手順');
		expect(md).toContain('## オーダー表');
		expect(md).toContain('B1・B2');
	});
});

describe('renderScoresCsv', () => {
	it('BOM付きで試合ごとの行を出力する', () => {
		const csv = renderScoresCsv(buildEmergencyView(fixtureState()));
		expect(csv.charCodeAt(0)).toBe(0xfeff);
		const lines = csv.trimEnd().split('\r\n');
		expect(lines[0]).toContain('tie_id,tie_name,match_id');
		expect(lines).toHaveLength(1 + 3);
		const xd1 = lines.find((l) => l.includes('match-2'))!;
		expect(xd1).toContain('21-18');
		expect(xd1).toContain('A1/A2');
	});
});

describe('renderEventLogNdjson', () => {
	it('1行1イベントのNDJSONを出力する', () => {
		const ndjson = renderEventLogNdjson(fixtureState().recentEvents);
		const rows = ndjson
			.trimEnd()
			.split('\n')
			.map((l) => JSON.parse(l));
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ id: 1842, type: 'rally_won', matchId: 'match-2' });
	});
});
