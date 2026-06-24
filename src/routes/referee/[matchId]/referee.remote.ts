import { form, getRequestEvent } from '$app/server';
import { otherSide } from '$lib/domain/scoring';
import {
	CourtAssignmentsSchema,
	LetReasonSchema,
	ServiceCourtSchema,
	SideSchema,
	SuspendReasonSchema
} from '$lib/domain/schemas';
import type {
	CourtAssignments,
	MatchPlayer,
	MatchState,
	ScoreEventInput,
	ServiceState
} from '$lib/domain/types';
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
import { fail } from '@sveltejs/kit';
import * as v from 'valibot';
import { buildRealtimeScorePayload, resolveRealtimeInput } from './refereeRealtime';

const sideSchema = SideSchema;

async function applyAction(
	matchId: string,
	buildInput: (
		state: Awaited<ReturnType<typeof getMatchState>>,
		players: MatchPlayer[]
	) => ScoreEventInput
) {
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
		return fail(400, { error: err instanceof Error ? err.message : '操作に失敗しました' });
	}
	const data = {
		score: buildRealtimeScorePayload(input, state, afterState)
	};
	notifyMatch(matchId, ['score'], data);
	notifyLiveBoard(['score'], data);
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

export const correction = form(
	v.object({
		gameNo: v.pipe(v.string(), v.transform(Number), v.integer()),
		scoreA: v.pipe(v.string(), v.transform(Number), v.integer()),
		scoreB: v.pipe(v.string(), v.transform(Number), v.integer()),
		reason: v.pipe(v.string(), v.nonEmpty()),
		servingSide: v.optional(v.string()),
		serviceCourt: v.optional(v.string()),
		serverPlayerId: v.optional(v.string()),
		receiverPlayerId: v.optional(v.string()),
		courtAssignmentsJson: v.optional(v.string())
	}),
	async ({
		gameNo,
		scoreA,
		scoreB,
		reason,
		servingSide,
		serviceCourt,
		serverPlayerId,
		receiverPlayerId,
		courtAssignmentsJson
	}) => {
		const event = getRequestEvent();
		const matchId = event.params.matchId!;
		const result = await applyAction(matchId, (state, players) => {
			const service = buildServiceFromArgs(
				{
					servingSide,
					serviceCourt,
					serverPlayerId,
					receiverPlayerId,
					courtAssignmentsJson
				},
				state.service,
				players
			);
			return {
				type: 'correction',
				idempotencyKey: crypto.randomUUID(),
				observedSeqNo: state.lastSeqNo,
				gameNo,
				score: { A: scoreA, B: scoreB },
				service,
				reason
			};
		});
		return result ?? {};
	}
);

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

export const suspend = form(
	v.object({
		reason: SuspendReasonSchema,
		note: v.optional(v.string())
	}),
	async ({ reason }) => {
		const event = getRequestEvent();
		const matchId = event.params.matchId!;
		const result = await applyAction(matchId, (state) => ({
			type: 'match_suspended',
			idempotencyKey: crypto.randomUUID(),
			observedSeqNo: state.lastSeqNo,
			reason
		}));
		return result ?? {};
	}
);

export const resume = form(async () => {
	const event = getRequestEvent();
	const matchId = event.params.matchId!;
	const result = await applyAction(matchId, (state) => ({
		type: 'match_resumed',
		idempotencyKey: crypto.randomUUID(),
		observedSeqNo: state.lastSeqNo
	}));
	return result ?? {};
});

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
		return fail(400, { error: err instanceof Error ? err.message : '操作に失敗しました' });
	}
	const afterState = await getMatchState(matchId);
	notifyMatch(matchId, ['score'], { score: { state: afterState, event: { type: 'cutoff' } } });
	notifyLiveBoard(['score'], { score: { state: afterState, event: { type: 'cutoff' } } });
});

export const confirm = form(async () => {
	const event = getRequestEvent();
	const matchId = event.params.matchId!;
	const result = await applyAction(matchId, (state) => ({
		type: 'match_confirmed',
		idempotencyKey: crypto.randomUUID(),
		observedSeqNo: state.lastSeqNo
	}));
	return result ?? {};
});

// ── helpers ──────────────────────────────────────────────────────────────────

function buildServiceFromArgs(
	args: {
		servingSide?: string;
		serviceCourt?: string;
		serverPlayerId?: string;
		receiverPlayerId?: string;
		courtAssignmentsJson?: string;
	},
	current: ServiceState | null,
	players: MatchPlayer[]
): ServiceState | undefined {
	const { servingSide, serviceCourt, serverPlayerId, receiverPlayerId, courtAssignmentsJson } =
		args;
	if (!servingSide && !serviceCourt && !serverPlayerId && !receiverPlayerId) return undefined;
	if (!servingSide || !serviceCourt || !serverPlayerId || !receiverPlayerId) {
		throw new Error('サービス状態を訂正する場合は全項目が必須です');
	}

	if (current?.discipline === 'doubles') {
		const service: ServiceState = {
			...current,
			servingSide: v.parse(SideSchema, servingSide),
			serviceCourt: v.parse(ServiceCourtSchema, serviceCourt),
			serverPlayerId,
			receiverPlayerId,
			courtAssignments: courtAssignmentsJson
				? v.parse(CourtAssignmentsSchema, JSON.parse(courtAssignmentsJson))
				: current.courtAssignments
		};
		validateServiceState(service, players);
		return service;
	}

	const service: ServiceState = {
		discipline: 'singles' as const,
		servingSide: v.parse(SideSchema, servingSide),
		serviceCourt: v.parse(ServiceCourtSchema, serviceCourt),
		serverPlayerId,
		receiverPlayerId
	};
	validateServiceState(service, players);
	return service;
}

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

function validateServiceState(service: ServiceState, players: MatchPlayer[]): void {
	if (service.serviceCourt !== 'right' && service.serviceCourt !== 'left') {
		throw new Error('サービスコートが不正です');
	}
	const server = findPlayer(players, service.serverPlayerId);
	const receiver = findPlayer(players, service.receiverPlayerId);
	if (server.side !== service.servingSide) throw new Error('サーバーのサイドが不正です');
	if (receiver.side !== otherSide(service.servingSide)) {
		throw new Error('レシーバーのサイドが不正です');
	}

	if (service.discipline === 'doubles') {
		validateCourtAssignments(service.courtAssignments, players);
		if (service.courtAssignments[service.servingSide][service.serviceCourt] !== server.id) {
			throw new Error('サーバーが指定サービスコートに配置されていません');
		}
		if (service.courtAssignments[receiver.side][service.serviceCourt] !== receiver.id) {
			throw new Error('レシーバーが対角サービスコートに配置されていません');
		}
	}
}

function validateCourtAssignments(assignments: CourtAssignments, players: MatchPlayer[]): void {
	const ids = [
		assignments.A?.right,
		assignments.A?.left,
		assignments.B?.right,
		assignments.B?.left
	];
	if (ids.some((id) => !id)) throw new Error('ダブルス配置の右/左が不足しています');
	if (new Set(ids).size !== 4) throw new Error('ダブルス配置に重複があります');
	for (const side of ['A', 'B'] as const) {
		for (const court of ['right', 'left'] as const) {
			const player = findPlayer(players, assignments[side][court]);
			if (player.side !== side) throw new Error('ダブルス配置のサイドが不正です');
		}
	}
}

function findPlayer(players: MatchPlayer[], playerId: string): MatchPlayer {
	const player = players.find((item) => item.id === playerId);
	if (!player) throw new Error('選手が見つかりません');
	return player;
}
