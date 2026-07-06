import {
	buildProgressionFromEvents,
	type ProgressionEvent,
	type ScorePoint
} from '$lib/utils/scoreProgression';
import type { LiveScoreEvent } from '$lib/realtime/channels';

export type ProgressionRealtimeState = {
	byMatchId: Record<string, ScorePoint[]>;
	eventsByMatchId: Record<string, ProgressionEvent[]>;
};

export function applyRealtimeProgressionEvent(
	matchId: string,
	scoreEvent: LiveScoreEvent | undefined,
	state: ProgressionRealtimeState
): ProgressionRealtimeState | 'refresh' | null {
	if (!scoreEvent?.type) return null;

	const events = state.eventsByMatchId[matchId];
	if (!events) return 'refresh';

	// seqNo は試合内で連番。連番検証なしに追加すると、切断中の取りこぼしは
	// 欠けたまま・重複受信は二重追加になり、スコア表示(完全な MatchState から
	// 再構築)とチャートがずれる。
	const lastSeqNo = events.length > 0 ? events[events.length - 1].seqNo : 0;
	if (scoreEvent.seqNo === undefined) return 'refresh';
	if (scoreEvent.seqNo <= lastSeqNo) return null; // 受信済み(重複)は無視
	if (scoreEvent.seqNo !== lastSeqNo + 1) return 'refresh'; // 取りこぼしあり

	const nextEvent: ProgressionEvent = {
		type: scoreEvent.type,
		seqNo: scoreEvent.seqNo,
		gameNo: scoreEvent.gameNo ?? null,
		scoreA: scoreEvent.scoreA ?? null,
		scoreB: scoreEvent.scoreB ?? null,
		targetSeqNo: scoreEvent.targetSeqNo ?? null
	};

	const nextEventsByMatchId = {
		...state.eventsByMatchId,
		[matchId]: [...events, nextEvent]
	};

	return {
		eventsByMatchId: nextEventsByMatchId,
		byMatchId: {
			...state.byMatchId,
			[matchId]: buildProgressionFromEvents(nextEventsByMatchId[matchId])
		}
	};
}
