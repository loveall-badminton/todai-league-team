import { eventTypeForInput } from '$lib/domain/scoreEvents';
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
	// DB の score_events 行と同じ規則(game_started は開始するゲームの番号)
	const inputGameNo = 'gameNo' in input ? (input as { gameNo?: number }).gameNo : undefined;
	const eventGameNo = inputGameNo ?? beforeState.currentGameNo;
	const eventGame = afterState.games.find((g) => g.gameNo === eventGameNo);
	const targetSeqNo = input.type === 'undo' ? (input as UndoInput).targetSeqNo : undefined;
	const inputSide = 'side' in input ? (input as { side: string }).side : undefined;

	return {
		type: eventTypeForInput(input),
		seqNo,
		...(inputSide !== undefined ? { side: inputSide } : {}),
		gameNo: eventGameNo,
		scoreA: eventGame?.score.A,
		scoreB: eventGame?.score.B,
		serverPlayerIdBefore: beforeState.service?.serverPlayerId ?? null,
		receiverPlayerIdBefore: beforeState.service?.receiverPlayerId ?? null,
		serverPlayerIdAfter: afterState.service?.serverPlayerId ?? null,
		receiverPlayerIdAfter: afterState.service?.receiverPlayerId ?? null,
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
