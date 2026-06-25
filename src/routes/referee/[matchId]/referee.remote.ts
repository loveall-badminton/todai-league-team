import { form, getRequestEvent } from '$app/server';
import { otherSide } from '$lib/domain/scoring';
import { LetReasonSchema, SideSchema } from '$lib/domain/schemas';
import type { MatchPlayer, MatchState, ScoreEventInput } from '$lib/domain/types';
import { requireRefereeMatchAccess } from '$lib/server/auth/access';
import { notifyLiveBoard, notifyMatch } from '$lib/server/realtime/broadcast';
import {
	getMatchWithPlayers,
	getMatchPlayers,
	getMatchState
} from '$lib/server/repositories/matchRepository';
import { applyMatchAction } from '$lib/server/services/matchActionService';
import { cancelMatchRubber } from '$lib/server/services/tieOperationService';
import { getLastUndoableScoreEvent } from '$lib/server/repositories/scoreEventRepository';
import * as v from 'valibot';
import { buildRealtimeScorePayload, resolveRealtimeInput } from './refereeRealtime';

const sideSchema = SideSchema;

async function applyAction(
	matchId: string,
	buildInput: (
		state: Awaited<ReturnType<typeof getMatchState>>,
		players: MatchPlayer[]
	) => ScoreEventInput
): Promise<{ error: string } | void> {
	await requireRefereeMatchAccess(matchId);
	const state = await getMatchState(matchId);
	const players = await getMatchPlayers(matchId);
	let afterState: MatchState;
	let input: ScoreEventInput;
	try {
		input = buildInput(state, players);
		const lastUndoableEvent =
			input.type === 'undo' && input.targetSeqNo === undefined
				? await getLastUndoableScoreEvent(matchId)
				: null;
		input = resolveRealtimeInput(input, lastUndoableEvent?.seqNo);
		afterState = await applyMatchAction({
			matchId,
			input,
			actorName: null,
			now: new Date().toISOString(),
			beforeState: state,
			players
		});
	} catch (err) {
		return { error: err instanceof Error ? err.message : '操作に失敗しました' };
	}

	notifyMatch(matchId, ['score'], {
		score: buildRealtimeScorePayload(input, state, afterState)
	});
	notifyLiveBoard(['score'], {
		score: buildRealtimeScorePayload(input, state, afterState)
	});

	if (['finished', 'forfeited', 'retired'].includes(afterState.status)) {
		const confirmInput: ScoreEventInput = {
			type: 'match_confirmed',
			idempotencyKey: crypto.randomUUID(),
			observedSeqNo: afterState.lastSeqNo
		};
		const confirmedState = await applyMatchAction({
			matchId,
			input: confirmInput,
			actorName: null,
			now: new Date().toISOString(),
			beforeState: afterState,
			players
		});
		notifyMatch(matchId, ['score'], {
			score: buildRealtimeScorePayload(confirmInput, afterState, confirmedState)
		});
		notifyLiveBoard(['score'], {
			score: buildRealtimeScorePayload(confirmInput, afterState, confirmedState)
		});
	}
}

export const start = form(
	v.object({
		initialServerPlayerId: v.string(),
		initialReceiverPlayerId: v.string()
	}),
	async ({ initialServerPlayerId, initialReceiverPlayerId }) => {
		const event = getRequestEvent();
		const matchId = event.params.matchId!;
		const result = await applyAction(matchId, (state, players) => {
			validateInitialServiceSelection(
				state,
				players,
				initialServerPlayerId,
				initialReceiverPlayerId
			);
			return {
				type: 'match_started',
				idempotencyKey: crypto.randomUUID(),
				observedSeqNo: state.lastSeqNo,
				initialServerPlayerId,
				initialReceiverPlayerId
			};
		});
		return result ?? {};
	}
);

export const startGame = form(
	v.object({
		gameNo: v.pipe(v.string(), v.transform(Number), v.integer()),
		initialServerPlayerId: v.string(),
		initialReceiverPlayerId: v.string()
	}),
	async ({ gameNo, initialServerPlayerId, initialReceiverPlayerId }) => {
		const event = getRequestEvent();
		const matchId = event.params.matchId!;
		const sides = await getMatchSideNames(matchId);
		const result = await applyAction(matchId, (state, players) => {
			validateInitialServiceSelection(
				state,
				players,
				initialServerPlayerId,
				initialReceiverPlayerId
			);
			validateNextGameServiceSelection(
				state,
				players,
				initialServerPlayerId,
				initialReceiverPlayerId,
				sides
			);
			return {
				type: 'game_started',
				idempotencyKey: crypto.randomUUID(),
				observedSeqNo: state.lastSeqNo,
				gameNo,
				initialServerPlayerId,
				initialReceiverPlayerId
			};
		});
		return result ?? {};
	}
);

export const rallyWon = form(v.object({ side: sideSchema }), async ({ side }) => {
	const event = getRequestEvent();
	const matchId = event.params.matchId!;
	const result = await applyAction(matchId, (state) => ({
		type: 'rally_won',
		idempotencyKey: crypto.randomUUID(),
		observedSeqNo: state.lastSeqNo,
		side
	}));
	return result ?? {};
});

export const undo = form(async () => {
	const event = getRequestEvent();
	const matchId = event.params.matchId!;
	const result = await applyAction(matchId, (state) => ({
		type: 'undo',
		idempotencyKey: crypto.randomUUID(),
		observedSeqNo: state.lastSeqNo
	}));
	return result ?? {};
});

export const letCalled = form(
	v.object({
		reason: LetReasonSchema,
		note: v.optional(v.string())
	}),
	async ({ reason, note }) => {
		const event = getRequestEvent();
		const matchId = event.params.matchId!;
		const result = await applyAction(matchId, (state) => ({
			type: 'let_called',
			idempotencyKey: crypto.randomUUID(),
			observedSeqNo: state.lastSeqNo,
			reason,
			note: note || undefined
		}));
		return result ?? {};
	}
);

export const forfeit = form(v.object({ side: sideSchema }), async ({ side }) => {
	const event = getRequestEvent();
	const matchId = event.params.matchId!;
	const result = await applyAction(matchId, (state) => ({
		type: 'side_forfeited',
		idempotencyKey: crypto.randomUUID(),
		observedSeqNo: state.lastSeqNo,
		side,
		reason: 'withdrawal'
	}));
	return result ?? {};
});

export const retire = form(v.object({ side: sideSchema }), async ({ side }) => {
	const event = getRequestEvent();
	const matchId = event.params.matchId!;
	const result = await applyAction(matchId, (state) => ({
		type: 'side_retired',
		idempotencyKey: crypto.randomUUID(),
		observedSeqNo: state.lastSeqNo,
		side,
		reason: 'injury'
	}));
	return result ?? {};
});

export const cutoff = form(async () => {
	const event = getRequestEvent();
	const matchId = event.params.matchId!;
	await requireRefereeMatchAccess(matchId);
	try {
		await cancelMatchRubber(matchId);
	} catch (err) {
		return { error: err instanceof Error ? err.message : '操作に失敗しました' };
	}
	const afterState = await getMatchState(matchId);
	notifyMatch(matchId, ['score'], { score: { state: afterState, event: { type: 'cutoff' } } });
	notifyLiveBoard(['score'], { score: { state: afterState, event: { type: 'cutoff' } } });
});

// ── helpers ──────────────────────────────────────────────────────────────────

function validateInitialServiceSelection(
	state: MatchState,
	players: MatchPlayer[],
	serverPlayerId: string,
	receiverPlayerId: string
): void {
	const server = findPlayer(players, serverPlayerId);
	const receiver = findPlayer(players, receiverPlayerId);
	if (server.side === receiver.side) {
		throw new Error('サーバーとレシーバーが同じチームになっています');
	}

	const aCount = players.filter((player) => player.side === 'A').length;
	const bCount = players.filter((player) => player.side === 'B').length;
	if (state.discipline === 'MS' || state.discipline === 'WS') {
		if (aCount !== 1 || bCount !== 1) throw new Error('シングルスは各サイド1名が必要です');
		return;
	}
	if (aCount !== 2 || bCount !== 2) throw new Error('ダブルスは各サイド2名が必要です');
}

function validateNextGameServiceSelection(
	state: MatchState,
	players: MatchPlayer[],
	serverPlayerId: string,
	receiverPlayerId: string,
	sides: SideNames
): void {
	const previousGame = state.games.find((game) => game.gameNo === state.currentGameNo - 1);
	if (!previousGame?.winnerSide) return;

	const server = findPlayer(players, serverPlayerId);
	const receiver = findPlayer(players, receiverPlayerId);
	const winner = sides[previousGame.winnerSide];
	const loser = sides[otherSide(previousGame.winnerSide)];
	if (server.side !== previousGame.winnerSide) {
		throw new Error(
			`前のゲームは「${winner}」が勝ちました。サーバーは「${winner}」の選手を選んでください（「${server.name}」は「${loser}」です）`
		);
	}
	if (receiver.side !== otherSide(previousGame.winnerSide)) {
		throw new Error(
			`前のゲームは「${winner}」が勝ちました。レシーバーは「${loser}」の選手を選んでください（「${receiver.name}」は「${winner}」です）`
		);
	}
}

type SideNames = Record<'A' | 'B', string>;

async function getMatchSideNames(matchId: string): Promise<SideNames> {
	const match = await getMatchWithPlayers(matchId);
	if (!match) throw new Error('Match not found');
	const a = match.match.sides.find((s) => s.side === 'A')?.displayName ?? 'A側';
	const b = match.match.sides.find((s) => s.side === 'B')?.displayName ?? 'B側';
	return { A: a, B: b };
}

function findPlayer(players: MatchPlayer[], playerId: string): MatchPlayer {
	const player = players.find((item) => item.id === playerId);
	if (!player) throw new Error('選手が見つかりません');
	return player;
}
