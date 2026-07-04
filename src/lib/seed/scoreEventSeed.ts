/**
 * シードデータ用のスコアイベント列生成。
 *
 * ライブページのスコア推移は score_events テーブル(rally_won イベント)だけから
 * 構築されるため、シードで matches / match_snapshots を作るだけでは
 * 「スコアデータがありません」になる。ゲームスコアと整合するラリー単位の
 * イベント列をここで決定的に生成し、シードスクリプトが score_events に挿入する。
 *
 * イベント数は 1 (match_started) + (games.length - 1) (第2ゲーム以降の game_started)
 * + 総得点 で、シードが match_snapshots / matches に書く lastSeqNo と一致する。
 */

export type SeedGame = { a: number; b: number };

/** プレーヤーは抽象スロットで表す(実 ID へのマッピングは呼び出し側) */
export type SeedSlot = 'A1' | 'A2' | 'B1' | 'B2';

export type SeedService = {
	servingSide: 'A' | 'B';
	serviceCourt: 'right' | 'left';
	serverSlot: SeedSlot;
	receiverSlot: SeedSlot;
};

export type SeedScoreEvent = {
	seqNo: number;
	eventType: 'match_started' | 'game_started' | 'rally_won';
	side: 'A' | 'B' | null;
	gameNo: number;
	scoreABefore: number;
	scoreBBefore: number;
	scoreAAfter: number;
	scoreBAfter: number;
	/** ゲーム間・試合開始前は null(本番経路と同じくゲーム終了ラリーの after も null) */
	serviceBefore: SeedService | null;
	serviceAfter: SeedService | null;
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
 *
 * サービス情報もダブルスのローテーション規則で再現する:
 * サーブ側が得点 → 同じサーバーが左右を替えて継続、レシーブ側が得点 → サーブ権移動。
 * スコアシート(RefereeScoresheet)は server_player_id_before/after からサービス
 * オーバーを判定するため、これが無いとシート上のスコア推移が描画されない。
 *
 * lastGameInProgress が true のとき、最終ゲームは進行中扱いにして
 * 最後のラリーでもサービスをクリアしない。
 */
export function buildSeedScoreEvents(
	games: SeedGame[],
	seed: number,
	options: { lastGameInProgress?: boolean } = {}
): SeedScoreEvent[] {
	const rng = createRng(seed);
	const events: SeedScoreEvent[] = [];
	let seqNo = 0;

	const push = (event: Omit<SeedScoreEvent, 'seqNo'>) => {
		seqNo += 1;
		events.push({ seqNo, ...event });
	};

	// サービス状態のリプレイ
	let assignments: Record<'A' | 'B', { right: SeedSlot; left: SeedSlot }> = {
		A: { right: 'A1', left: 'A2' },
		B: { right: 'B1', left: 'B2' }
	};
	let servingSide: 'A' | 'B' = 'A';
	const serviceOf = (scoreA: number, scoreB: number): SeedService => {
		const score = servingSide === 'A' ? scoreA : scoreB;
		const court = score % 2 === 0 ? ('right' as const) : ('left' as const);
		const receiverSide = servingSide === 'A' ? 'B' : 'A';
		return {
			servingSide,
			serviceCourt: court,
			serverSlot: assignments[servingSide][court],
			receiverSlot: assignments[receiverSide][court]
		};
	};
	const resetGame = (firstServingSide: 'A' | 'B') => {
		assignments = {
			A: { right: 'A1', left: 'A2' },
			B: { right: 'B1', left: 'B2' }
		};
		servingSide = firstServingSide;
	};

	push({
		eventType: 'match_started',
		side: null,
		gameNo: 1,
		scoreABefore: 0,
		scoreBBefore: 0,
		scoreAAfter: 0,
		scoreBAfter: 0,
		serviceBefore: null,
		serviceAfter: serviceOf(0, 0)
	});

	games.forEach((game, gameIndex) => {
		const gameNo = gameIndex + 1;
		// game_started はインターバル明け(第2ゲーム以降)のみ。第1ゲームは
		// match_started に含まれる(本番の状態遷移と同じ)。
		if (gameIndex > 0) {
			const prev = games[gameIndex - 1];
			// 次ゲームの最初のサーブは前ゲームの勝者側
			resetGame(prev.a > prev.b ? 'A' : 'B');
			push({
				eventType: 'game_started',
				side: null,
				gameNo,
				scoreABefore: 0,
				scoreBBefore: 0,
				scoreAAfter: 0,
				scoreBAfter: 0,
				serviceBefore: null,
				serviceAfter: serviceOf(0, 0)
			});
		}

		const gameInProgress = options.lastGameInProgress === true && gameIndex === games.length - 1;
		const order = makeRallyOrder(game, rng);
		let scoreA = 0;
		let scoreB = 0;
		order.forEach((side, rallyIndex) => {
			const serviceBefore = serviceOf(scoreA, scoreB);
			const before = { scoreABefore: scoreA, scoreBBefore: scoreB };
			if (side === 'A') scoreA += 1;
			else scoreB += 1;

			if (side === servingSide) {
				// サーブ側の得点: サーバーペアが左右を入れ替える
				const a = assignments[side];
				assignments = { ...assignments, [side]: { right: a.left, left: a.right } };
			} else {
				servingSide = side;
			}
			const gameEnded = rallyIndex === order.length - 1 && !gameInProgress;

			push({
				eventType: 'rally_won',
				side,
				gameNo,
				...before,
				scoreAAfter: scoreA,
				scoreBAfter: scoreB,
				serviceBefore,
				serviceAfter: gameEnded ? null : serviceOf(scoreA, scoreB)
			});
		});
	});

	return events;
}
