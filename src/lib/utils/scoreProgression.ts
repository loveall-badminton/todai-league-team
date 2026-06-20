export type ScorePoint = { gameNo: number; scoreA: number; scoreB: number };
export type SeriesPoint = { x: number; y: number };

export type ProgressionEvent = {
	type: string;
	seqNo: number;
	gameNo: number | null;
	scoreA: number | null;
	scoreB: number | null;
	targetSeqNo: number | null;
};

/**
 * イベント列からスコア推移ポイント列を構築する。
 *
 * - `undo`/`undo_applied` は、`[targetSeqNo, undoSeqNo)` の範囲の
 *   `rally_won` をすべて無効化する（取り消し前の状態への巻き戻しにより
 *   後続ラリーも無効になるため）
 * - seqNo 昇順に処理することを前提とする
 */
export function buildProgressionFromEvents(events: ProgressionEvent[]): ScorePoint[] {
	const excluded = new Set<number>();
	for (const e of events) {
		if ((e.type === 'undo_applied' || e.type === 'undo') && e.targetSeqNo != null) {
			for (let s = e.targetSeqNo; s < e.seqNo; s++) {
				excluded.add(s);
			}
		}
	}
	const points: ScorePoint[] = [];
	for (const e of events) {
		if (
			e.type === 'rally_won' &&
			e.gameNo != null &&
			e.scoreA != null &&
			e.scoreB != null &&
			!excluded.has(e.seqNo)
		) {
			points.push({ gameNo: e.gameNo, scoreA: e.scoreA, scoreB: e.scoreB });
		}
	}
	return points;
}

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
