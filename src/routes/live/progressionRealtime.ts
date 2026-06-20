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

	const nextEvent: ProgressionEvent = {
		type: scoreEvent.type,
		seqNo: scoreEvent.seqNo ?? events.length + 1,
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
