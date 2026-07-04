/**
 * シードデータ用のスコアイベント列生成。
 *
 * ライブページのスコア推移は score_events テーブル(rally_won イベント)だけから
 * 構築されるため、シードで matches / match_snapshots を作るだけでは
 * 「スコアデータがありません」になる。ゲームスコアと整合するラリー単位の
 * イベント列をここで決定的に生成し、シードスクリプトが score_events に挿入する。
 *
 * イベント数は 1 (match_started) + games.length (game_started) + 総得点 で、
 * シードが match_snapshots / matches に書く lastSeqNo と一致する。
 */

export type SeedGame = { a: number; b: number };

export type SeedScoreEvent = {
	seqNo: number;
	eventType: 'match_started' | 'game_started' | 'rally_won';
	side: 'A' | 'B' | null;
	gameNo: number;
	scoreABefore: number;
	scoreBBefore: number;
	scoreAAfter: number;
	scoreBAfter: number;
};

/** 決定的な擬似乱数(シード再現性のため Math.random は使わない) */
function createRng(seed: number) {
	let state = (seed >>> 0) + 0x9e3779b9;
	return () => {
		state = (state * 1664525 + 1013904223) >>> 0;
		return state / 0x100000000;
	};
}

/**
 * 1ゲーム分のラリー勝者列を生成する。
 * 最終スコアに到達し、勝っている側が最後のラリーを取る。
 */
function makeRallyOrder(game: SeedGame, rng: () => number): Array<'A' | 'B'> {
	const lastSide: 'A' | 'B' | null = game.a > game.b ? 'A' : game.b > game.a ? 'B' : null;
	let remainingA = game.a - (lastSide === 'A' ? 1 : 0);
	let remainingB = game.b - (lastSide === 'B' ? 1 : 0);

	const order: Array<'A' | 'B'> = [];
	while (remainingA > 0 || remainingB > 0) {
		const pickA =
			remainingB === 0 || (remainingA > 0 && rng() < remainingA / (remainingA + remainingB));
		if (pickA) {
			order.push('A');
			remainingA -= 1;
		} else {
			order.push('B');
			remainingB -= 1;
		}
	}
	if (lastSide) order.push(lastSide);
	return order;
}

/**
 * ゲームスコア列からスコアイベント列を生成する。
 * games が空の場合(開始直後・中止など)は match_started のみを返す。
 */
export function buildSeedScoreEvents(games: SeedGame[], seed: number): SeedScoreEvent[] {
	const rng = createRng(seed);
	const events: SeedScoreEvent[] = [];
	let seqNo = 0;

	const push = (event: Omit<SeedScoreEvent, 'seqNo'>) => {
		seqNo += 1;
		events.push({ seqNo, ...event });
	};

	push({
		eventType: 'match_started',
		side: null,
		gameNo: 1,
		scoreABefore: 0,
		scoreBBefore: 0,
		scoreAAfter: 0,
		scoreBAfter: 0
	});

	games.forEach((game, gameIndex) => {
		const gameNo = gameIndex + 1;
		push({
			eventType: 'game_started',
			side: null,
			gameNo,
			scoreABefore: 0,
			scoreBBefore: 0,
			scoreAAfter: 0,
			scoreBAfter: 0
		});

		let scoreA = 0;
		let scoreB = 0;
		for (const side of makeRallyOrder(game, rng)) {
			const before = { scoreABefore: scoreA, scoreBBefore: scoreB };
			if (side === 'A') scoreA += 1;
			else scoreB += 1;
			push({
				eventType: 'rally_won',
				side,
				gameNo,
				...before,
				scoreAAfter: scoreA,
				scoreBAfter: scoreB
			});
		}
	});

	return events;
}
