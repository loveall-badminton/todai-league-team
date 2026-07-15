import {
	createResyncFailedMessage,
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

	const oldestSeqNo = recentMessages[0].seqNo ?? 0;
	const newestSeqNo = recentMessages[recentMessages.length - 1].seqNo ?? 0;

	// クライアントの seqNo がバッファ最新より進んでいる = DO 再起動などで
	// サーバー側のカウンタが巻き戻った。全更新を取りこぼしている可能性があるため
	// resync_failed を返してクライアントにフル refresh させる。
	if (sinceSeqNo > newestSeqNo) {
		return [createResyncFailedMessage()];
	}

	// バッファがそこまで遡れない(欠落が確定)
	if (sinceSeqNo + 1 < oldestSeqNo) {
		return [createResyncFailedMessage()];
	}

	return recentMessages.filter((m) => (m.seqNo ?? 0) > sinceSeqNo);
}

/** パース済みメッセージが resync リクエストなら、バッファから再送分を解決する。 */
export function computeResyncReplies(
	message: LiveMessage,
	recentMessages: readonly LiveUpdatedMessage[]
): LiveMessage[] {
	if (message.type !== 'resync') return [];
	return resolveResyncReplies(message.sinceSeqNo, recentMessages);
}
