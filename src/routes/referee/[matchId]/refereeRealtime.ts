import type { MatchState } from '$lib/domain/types';
import type { LiveScoreEvent, LiveTopicPayloadMap } from '$lib/realtime/channels';

export {
	buildRealtimeScoreEvent,
	buildRealtimeScorePayload,
	resolveRealtimeInput
} from '$lib/realtime/matchScorePayload';

/** 審判画面が必要とするイベント行(DB の score_events 行のサブセット互換) */
export type RefereeEventView = {
	id: string;
	seqNo: number;
	eventType: string;
	side: string | null;
	gameNo: number | null;
	scoreAAfter: number | null;
	scoreBAfter: number | null;
	serverPlayerIdBefore: string | null;
	serverPlayerIdAfter: string | null;
	receiverPlayerIdBefore: string | null;
	receiverPlayerIdAfter: string | null;
	targetSeqNo: number | null;
};

export type RefereeLiveView = {
	state: MatchState;
	events: RefereeEventView[];
};

// これらは score_events の連番に乗らず match 行のメタ(勝者確認・運営承認など)を
// 変えるため、差分適用では追従できない。load 再実行で取り直す。
const REFRESH_EVENT_TYPES = new Set([
	'cutoff',
	'winner_confirmed',
	'winner_unconfirmed',
	'match_confirmed',
	'match_unconfirmed'
]);

/**
 * score トピックの payload を審判画面のローカル表示へ差分適用する。
 * - 適用できたら新しいビューを返す
 * - 連番が飛んでいる・メタ変更イベントの場合は 'refresh'(load 再実行が必要)
 * - 受信済み・別試合の場合は null(何もしない)
 */
export function applyRefereeScorePayload(
	payload: LiveTopicPayloadMap['score'],
	current: RefereeLiveView
): RefereeLiveView | 'refresh' | null {
	const event = payload.event;
	if (event?.type && REFRESH_EVENT_TYPES.has(event.type)) return 'refresh';

	const incoming = payload.state;
	if (incoming.matchId !== current.state.matchId) return null;
	if (incoming.lastSeqNo <= current.state.lastSeqNo) return null; // 受信済み(重複)

	// イベント連番が続いている場合のみログへ追記できる。飛んでいたら取りこぼしあり
	if (
		event?.seqNo === undefined ||
		event.seqNo !== current.state.lastSeqNo + 1 ||
		incoming.lastSeqNo !== event.seqNo
	) {
		return 'refresh';
	}

	return {
		state: incoming,
		events: [...current.events, toRefereeEventView(event)]
	};
}

function toRefereeEventView(event: LiveScoreEvent): RefereeEventView {
	return {
		id: `live-${event.seqNo}`,
		seqNo: event.seqNo!,
		eventType: event.type,
		side: event.side ?? null,
		gameNo: event.gameNo ?? null,
		scoreAAfter: event.scoreA ?? null,
		scoreBAfter: event.scoreB ?? null,
		serverPlayerIdBefore: event.serverPlayerIdBefore ?? null,
		serverPlayerIdAfter: event.serverPlayerIdAfter ?? null,
		receiverPlayerIdBefore: event.receiverPlayerIdBefore ?? null,
		receiverPlayerIdAfter: event.receiverPlayerIdAfter ?? null,
		targetSeqNo: event.targetSeqNo ?? null
	};
}
