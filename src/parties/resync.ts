import {
	createResyncFailedMessage,
	parseLiveMessage,
	type LiveMessage,
	type LiveUpdatedMessage
} from '$lib/realtime/channels';

/**
 * DO が保持する直近の updated バッファから、sinceSeqNo より新しいメッセージを
 * 返す。バッファがそこまで遡れない(欠落が確定している)場合は resync_failed を返す。
 * DO ランタイムに依存しない純粋関数として、通常の vitest プロジェクトでテストできる。
 */
export function resolveResyncReplies(
	sinceSeqNo: number,
	recentMessages: readonly LiveUpdatedMessage[]
): LiveMessage[] {
	if (recentMessages.length === 0) {
		// バッファが空 = DO 再起動直後などで履歴を持っていない。
		// sinceSeqNo が 0(＝クライアントがまだ何も受け取っていない)なら
		// 取りこぼしは無いはずなので何も返さない。
		return sinceSeqNo <= 0 ? [] : [createResyncFailedMessage()];
	}

	const oldestSeqNo = recentMessages[0].seqNo;
	if (oldestSeqNo === undefined || sinceSeqNo + 1 < oldestSeqNo) {
		return [createResyncFailedMessage()];
	}

	return recentMessages.filter((m) => (m.seqNo ?? 0) > sinceSeqNo);
}

/** onMessage で受け取った生メッセージから resync リクエストを解決する。 */
export function computeResyncReplies(
	message: unknown,
	recentMessages: readonly LiveUpdatedMessage[]
): LiveMessage[] {
	if (typeof message !== 'string') return [];
	let raw: unknown;
	try {
		raw = JSON.parse(message);
	} catch {
		return [];
	}
	const parsed = parseLiveMessage(raw);
	if (parsed?.type !== 'resync') return [];
	return resolveResyncReplies(parsed.sinceSeqNo, recentMessages);
}
