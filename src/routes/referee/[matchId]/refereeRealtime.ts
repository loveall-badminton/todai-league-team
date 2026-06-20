import type { MatchState, ScoreEventInput, UndoInput } from '$lib/domain/types';
import type { LiveTopicPayloadMap } from '$lib/realtime/channels';

export function resolveRealtimeInput(
	input: ScoreEventInput,
	lastUndoableSeqNo?: number
): ScoreEventInput {
	if (input.type !== 'undo' || input.targetSeqNo !== undefined || lastUndoableSeqNo === undefined) {
		return input;
	}

	return {
		...input,
		targetSeqNo: lastUndoableSeqNo
	};
}

export function buildRealtimeScoreEvent(
	input: ScoreEventInput,
	beforeState: MatchState,
	afterState: MatchState
): LiveTopicPayloadMap['score']['event'] {
	const seqNo = afterState.lastSeqNo;
	const eventGameNo = beforeState.currentGameNo;
	const eventGame = afterState.games.find((g) => g.gameNo === eventGameNo);
	const targetSeqNo = input.type === 'undo' ? (input as UndoInput).targetSeqNo : undefined;

	return {
		type: input.type,
		seqNo,
		...(input.type === 'rally_won'
			? {
					gameNo: eventGameNo,
					scoreA: eventGame?.score.A,
					scoreB: eventGame?.score.B
				}
			: {}),
		...(targetSeqNo !== undefined ? { targetSeqNo } : {})
	};
}

export function buildRealtimeScorePayload(
	input: ScoreEventInput,
	beforeState: MatchState,
	afterState: MatchState
): LiveTopicPayloadMap['score'] {
	return {
		state: afterState,
		event: buildRealtimeScoreEvent(input, beforeState, afterState)
	};
}
