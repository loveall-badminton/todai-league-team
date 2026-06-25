import type { MatchPlayer, MatchState, ScoreEventInput } from '$lib/domain/types';
import { buildRealtimeScorePayload, resolveRealtimeInput } from '$lib/realtime/matchScorePayload';
import { getMatchPlayers, getMatchState } from '$lib/server/repositories/matchRepository';
import { getLastUndoableScoreEvent } from '$lib/server/repositories/scoreEventRepository';
import { applyMatchAction } from '$lib/server/services/matchActionService';

const autoConfirmStatuses = new Set(['finished', 'forfeited', 'retired']);

export type MatchActionRealtimeResult = {
	input: ScoreEventInput;
	beforeState: MatchState;
	afterState: MatchState;
	players: MatchPlayer[];
	scorePayload: ReturnType<typeof buildRealtimeScorePayload>;
};

export async function applyMatchActionWithRealtime(params: {
	matchId: string;
	input: ScoreEventInput;
	actorName?: string | null;
	now: string;
	beforeState?: MatchState;
	players?: MatchPlayer[];
}): Promise<MatchActionRealtimeResult> {
	const beforeState = params.beforeState ?? (await getMatchState(params.matchId));
	const players = params.players ?? (await getMatchPlayers(params.matchId));
	const lastUndoableEvent =
		params.input.type === 'undo' && params.input.targetSeqNo === undefined
			? await getLastUndoableScoreEvent(params.matchId)
			: null;
	const input = resolveRealtimeInput(params.input, lastUndoableEvent?.seqNo);
	const afterState = await applyMatchAction({
		matchId: params.matchId,
		input,
		actorName: params.actorName,
		now: params.now,
		beforeState,
		players
	});

	return {
		input,
		beforeState,
		afterState,
		players,
		scorePayload: buildRealtimeScorePayload(input, beforeState, afterState)
	};
}

export async function autoConfirmMatchIfComplete(params: {
	matchId: string;
	state: MatchState;
	players: MatchPlayer[];
	actorName?: string | null;
	now: string;
}): Promise<MatchActionRealtimeResult | null> {
	if (!autoConfirmStatuses.has(params.state.status)) return null;

	const input: ScoreEventInput = {
		type: 'match_confirmed',
		idempotencyKey: crypto.randomUUID(),
		observedSeqNo: params.state.lastSeqNo
	};

	return applyMatchActionWithRealtime({
		matchId: params.matchId,
		input,
		actorName: params.actorName,
		now: params.now,
		beforeState: params.state,
		players: params.players
	});
}
