import { isResultMatchStatus, isTerminalRubberStatus } from './matchStatus';

/**
 * 対抗戦(tie)の進行判定。5ラバー・3勝先取の集計ルールを純粋関数として持つ。
 * ties.status が取りうる値の唯一の定義。DB スキーマ・API スキーマはここから import する。
 */
export const TIE_STATUSES = [
	'scheduled',
	'lineup_pending',
	'lineup_submitted',
	'playing',
	'finished',
	'confirmed',
	'cancelled'
] as const;

export type TieStatus = (typeof TIE_STATUSES)[number];

export const RUBBERS_PER_TIE = 5;
export const RUBBER_WINS_TO_CLINCH = 3;

export type TieResultInput = {
	teamAId: string | null;
	teamBId: string | null;
	status: TieStatus;
};

export type RubberResultInput = {
	winnerSide: 'A' | 'B' | null;
	status: string;
};

export function calculateTieResult(tie: TieResultInput, rubberRows: RubberResultInput[]) {
	const teamScoreA = rubberRows.filter((rubber) => rubber.winnerSide === 'A').length;
	const teamScoreB = rubberRows.filter((rubber) => rubber.winnerSide === 'B').length;
	const winnerTeamId =
		teamScoreA >= RUBBER_WINS_TO_CLINCH
			? tie.teamAId
			: teamScoreB >= RUBBER_WINS_TO_CLINCH
				? tie.teamBId
				: null;
	const allDone =
		rubberRows.length === RUBBERS_PER_TIE &&
		rubberRows.every((rubber) => isTerminalRubberStatus(rubber.status));
	const hasActiveRubber = rubberRows.some((rubber) => rubber.status === 'playing');
	// 3勝到達で勝敗自体は決するが、残りのラバーを消化するかは任意なので、
	// 「進行中のラバーが無い」ことも finished 扱いの条件に含める。
	const decided = allDone || (winnerTeamId !== null && !hasActiveRubber);
	const status: TieStatus =
		tie.status === 'confirmed'
			? tie.status
			: hasActiveRubber
				? 'playing'
				: decided
					? 'finished'
					: tie.status;
	return {
		teamScoreA,
		teamScoreB,
		winnerTeamId,
		status,
		allDone,
		decided
	};
}

/**
 * 勝敗結果を持つ試合ステータスをラバーの結果ステータスへ変換する。
 * 結果が出ていない(進行中・開始前)場合は null。
 */
export function rubberStatusFromMatchResultStatus(
	matchStatus: string
): 'finished' | 'confirmed' | null {
	if (!isResultMatchStatus(matchStatus)) return null;
	return matchStatus === 'confirmed' ? 'confirmed' : 'finished';
}
