import { rubberStatusForMatchStatus } from '$lib/domain/matchStatus';
import type { MatchState } from '$lib/domain/types';

export type RubberScorePatch = {
	lastSeqNo: number;
	gamesScore: string;
	pointScore: string | null;
	gameDetails: {
		gameNo: number;
		scoreA: number;
		scoreB: number;
		winnerSide: 'A' | 'B' | null;
	}[];
	matchStatus: MatchState['status'];
	winnerSide: MatchState['winnerSide'];
	status?: NonNullable<ReturnType<typeof rubberStatusForMatchStatus>>;
};

/**
 * score トピックのブロードキャストに載った MatchState から、種目一覧の行に
 * ローカル適用できるパッチを作る。refetch せずに WS 配信のみでスコア表示を
 * 更新するための共通ロジック。
 */
export function buildRubberScorePatch(state: MatchState): RubberScorePatch {
	const currentGame = state.games.find((g) => g.gameNo === state.currentGameNo);
	const patch: RubberScorePatch = {
		lastSeqNo: state.lastSeqNo,
		gamesScore: `${state.gamesWon.A}-${state.gamesWon.B}`,
		pointScore: currentGame ? `${currentGame.score.A}-${currentGame.score.B}` : null,
		gameDetails: state.games.map((g) => ({
			gameNo: g.gameNo,
			scoreA: g.score.A,
			scoreB: g.score.B,
			winnerSide: g.winnerSide
		})),
		matchStatus: state.status,
		winnerSide: state.winnerSide
	};
	const rubberStatus = rubberStatusForMatchStatus(state.status);
	// 未開始(scheduled)への巻き戻しは表示側で扱わないため上書きしない
	if (rubberStatus && rubberStatus !== 'scheduled') patch.status = rubberStatus;
	return patch;
}
