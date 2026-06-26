import type { MatchPlayer, MatchState, ScoreEventInput } from '$lib/domain/types';
import { buildRealtimeScorePayload } from '$lib/realtime/matchScorePayload';
import { getMatchPlayers, getMatchState } from '$lib/server/repositories/matchRepository';
import { applySerializedMatchAction } from '$lib/server/services/matchActionSerializedService';

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
	const { afterState, input } = await applySerializedMatchAction({
		matchId: params.matchId,
		input: params.input,
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
