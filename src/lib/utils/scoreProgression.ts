export type ScorePoint = { gameNo: number; scoreA: number; scoreB: number };
export type SeriesPoint = { x: number; y: number };

/**
 * スコア推移チャート用のデータ系列を構築する。
 *
 * - 最後のゲームのポイントだけを対象にする
 * - 連続して同一スコアのエントリを除去する
 * - 原点 (0–0) を先頭に付加する
 */
export function buildScoreProgressionSeries(
	points: ScorePoint[]
): { a: SeriesPoint[]; b: SeriesPoint[] } | null {
	if (points.length === 0) return null;

	const lastGame = points[points.length - 1].gameNo;
	const raw = points.filter((p) => p.gameNo === lastGame);
	const deduped = raw.filter(
		(p, i) => i === 0 || p.scoreA !== raw[i - 1].scoreA || p.scoreB !== raw[i - 1].scoreB
	);
	const withOrigin = [{ scoreA: 0, scoreB: 0 }, ...deduped];

	return {
		a: withOrigin.map((p, i) => ({ x: i, y: p.scoreA })),
		b: withOrigin.map((p, i) => ({ x: i, y: p.scoreB }))
	};
}
