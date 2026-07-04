import { describe, expect, test } from 'vitest';
import { buildSeedScoreEvents, type SeedGame, type SeedScoreEvent } from './scoreEventSeed';
import {
	buildProgressionFromEvents,
	filterScorePointsByGame,
	getScoreProgressionGameNos
} from '$lib/utils/scoreProgression';

// ライブページ(getScoreProgressionForTie / LiveTieDetail)が消費する形式に変換する
function toProgressionEvents(events: SeedScoreEvent[]) {
	return events.map((e) => ({
		type: e.eventType,
		seqNo: e.seqNo,
		gameNo: e.gameNo,
		scoreA: e.scoreAAfter,
		scoreB: e.scoreBAfter,
		targetSeqNo: null
	}));
}

const CASES: Array<{ name: string; games: SeedGame[] }> = [
	{
		name: '2ゲームストレート',
		games: [
			{ a: 15, b: 8 },
			{ a: 15, b: 11 }
		]
	},
	{
		name: 'フルゲーム',
		games: [
			{ a: 15, b: 12 },
			{ a: 6, b: 15 },
			{ a: 15, b: 9 }
		]
	},
	{ name: '進行中(第1ゲーム途中)', games: [{ a: 5, b: 8 }] },
	{
		name: '進行中(第2ゲーム途中・同点)',
		games: [
			{ a: 15, b: 11 },
			{ a: 7, b: 7 }
		]
	}
];

describe('buildSeedScoreEvents', () => {
	test.each(CASES)('$name: スコア推移がゲームスコアと整合する', ({ games }) => {
		const events = buildSeedScoreEvents(games, 42);
		const points = buildProgressionFromEvents(toProgressionEvents(events));

		// ライブページのスコア推移チャートが「スコアデータがありません」に
		// ならないこと(= 得点があるゲームには必ずポイントが存在する)
		expect(getScoreProgressionGameNos(points)).toEqual(
			games.map((_, i) => i + 1).filter((n) => games[n - 1].a + games[n - 1].b > 0)
		);

		games.forEach((game, i) => {
			const gamePoints = filterScorePointsByGame(points, i + 1);
			expect(gamePoints).toHaveLength(game.a + game.b);
			const last = gamePoints[gamePoints.length - 1];
			expect(last).toEqual({ gameNo: i + 1, scoreA: game.a, scoreB: game.b });
			// 1ラリー1点ずつ単調に増える
			gamePoints.forEach((p, j) => {
				expect(p.scoreA + p.scoreB).toBe(j + 1);
			});
		});
	});

	test('seqNo が 1 から連番で、件数が matches.last_seq_no と一致する', () => {
		const games: SeedGame[] = [
			{ a: 15, b: 8 },
			{ a: 15, b: 11 }
		];
		const events = buildSeedScoreEvents(games, 7);
		events.forEach((e, i) => expect(e.seqNo).toBe(i + 1));
		const totalPoints = games.reduce((sum, g) => sum + g.a + g.b, 0);
		// match_started + game_started × (第2ゲーム以降) + ラリー数
		expect(events).toHaveLength(1 + (games.length - 1) + totalPoints);
	});

	test('games が空なら match_started のみ', () => {
		const events = buildSeedScoreEvents([], 1);
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({ seqNo: 1, eventType: 'match_started' });
	});

	test('同じ seed なら決定的に同じ列を返す', () => {
		const games: SeedGame[] = [{ a: 15, b: 12 }];
		expect(buildSeedScoreEvents(games, 3)).toEqual(buildSeedScoreEvents(games, 3));
	});
});
