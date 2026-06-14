import { command, getRequestEvent } from '$app/server';
import { otherSide } from '$lib/domain/scoring';
import type {
	CourtAssignments,
	MatchPlayer,
	MatchState,
	ScoreEventInput,
	ServiceCourt,
	ServiceState,
	Side
} from '$lib/domain/types';
import { requireRefereeMatchAccess } from '$lib/server/auth/access';
import { getMatchPlayers, getMatchState } from '$lib/server/repositories/matchRepository';
import { applyMatchAction } from '$lib/server/services/matchActionService';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

const sideSchema = v.picklist(['A', 'B'] as const);

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
	try {
		await applyMatchAction({
			matchId,
			input: buildInput(state, players),
			actorName: null,
			now: new Date().toISOString()
		});
	} catch (err) {
		error(400, err instanceof Error ? err.message : '操作に失敗しました');
	}
}

export const start = command(
	v.object({
		initialServerPlayerId: v.string(),
		initialReceiverPlayerId: v.string()
	}),
	async ({ initialServerPlayerId, initialReceiverPlayerId }) => {
		const event = getRequestEvent();
		const matchId = event.params.matchId!;
		await applyAction(matchId, (state, players) => {
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
	}
);

export const startGame = command(
	v.object({
		gameNo: v.pipe(v.unknown(), v.transform(Number), v.number(), v.integer()),
		initialServerPlayerId: v.string(),
		initialReceiverPlayerId: v.string()
	}),
	async ({ gameNo, initialServerPlayerId, initialReceiverPlayerId }) => {
		const event = getRequestEvent();
		const matchId = event.params.matchId!;
		await applyAction(matchId, (state, players) => {
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
				initialReceiverPlayerId
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
	}
);

export const rallyWon = command(v.object({ side: sideSchema }), async ({ side }) => {
	const event = getRequestEvent();
	const matchId = event.params.matchId!;
	await applyAction(matchId, (state) => ({
		type: 'rally_won',
		idempotencyKey: crypto.randomUUID(),
		observedSeqNo: state.lastSeqNo,
		side
	}));
});

export const undo = command(
	v.object({
		targetSeqNo: v.optional(v.pipe(v.unknown(), v.transform(Number), v.number(), v.integer())),
		reason: v.optional(v.string())
	}),
	async ({ targetSeqNo, reason }) => {
		const event = getRequestEvent();
		const matchId = event.params.matchId!;
		await applyAction(matchId, (state) => ({
			type: 'undo',
			idempotencyKey: crypto.randomUUID(),
			observedSeqNo: state.lastSeqNo,
			targetSeqNo,
			reason: reason || undefined
		}));
	}
);

export const correction = command(
	v.object({
		gameNo: v.pipe(v.unknown(), v.transform(Number), v.number(), v.integer()),
		scoreA: v.pipe(v.unknown(), v.transform(Number), v.number(), v.integer()),
		scoreB: v.pipe(v.unknown(), v.transform(Number), v.number(), v.integer()),
		reason: v.pipe(v.string(), v.minLength(1)),
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
		await applyAction(matchId, (state, players) => {
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
	}
);

export const letCalled = command(
	v.object({
		reason: v.string(),
		note: v.optional(v.string())
	}),
	async ({ reason, note }) => {
		const event = getRequestEvent();
		const matchId = event.params.matchId!;
		await applyAction(matchId, (state) => ({
			type: 'let_called',
			idempotencyKey: crypto.randomUUID(),
			observedSeqNo: state.lastSeqNo,
			reason: (reason || 'other') as ScoreEventInput extends infer T
				? T extends { type: 'let_called'; reason: infer R }
					? R
					: never
				: never,
			note: note || undefined
		}));
	}
);

export const suspend = command(
	v.object({
		reason: v.optional(v.string()),
		note: v.optional(v.string())
	}),
	async ({ reason, note }) => {
		const event = getRequestEvent();
		const matchId = event.params.matchId!;
		await applyAction(matchId, (state) => ({
			type: 'match_suspended',
			idempotencyKey: crypto.randomUUID(),
			observedSeqNo: state.lastSeqNo,
			reason: (reason || 'other') as 'other',
			note: note || undefined
		}));
	}
);

export const resume = command(
	v.object({
		note: v.optional(v.string())
	}),
	async ({ note }) => {
		const event = getRequestEvent();
		const matchId = event.params.matchId!;
		await applyAction(matchId, (state) => ({
			type: 'match_resumed',
			idempotencyKey: crypto.randomUUID(),
			observedSeqNo: state.lastSeqNo,
			note: note || undefined
		}));
	}
);

export const forfeit = command(v.object({ side: sideSchema }), async ({ side }) => {
	const event = getRequestEvent();
	const matchId = event.params.matchId!;
	await applyAction(matchId, (state) => ({
		type: 'side_forfeited',
		idempotencyKey: crypto.randomUUID(),
		observedSeqNo: state.lastSeqNo,
		side,
		reason: 'withdrawal'
	}));
});

export const retire = command(v.object({ side: sideSchema }), async ({ side }) => {
	const event = getRequestEvent();
	const matchId = event.params.matchId!;
	await applyAction(matchId, (state) => ({
		type: 'side_retired',
		idempotencyKey: crypto.randomUUID(),
		observedSeqNo: state.lastSeqNo,
		side,
		reason: 'injury'
	}));
});

export const confirm = command(async () => {
	const event = getRequestEvent();
	const matchId = event.params.matchId!;
	await applyAction(matchId, (state) => ({
		type: 'match_confirmed',
		idempotencyKey: crypto.randomUUID(),
		observedSeqNo: state.lastSeqNo
	}));
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
		error(400, 'サービス状態を訂正する場合は全項目が必須です');
	}

	if (current?.discipline === 'doubles') {
		const service: ServiceState = {
			...current,
			servingSide: servingSide as Side,
			serviceCourt: serviceCourt as ServiceCourt,
			serverPlayerId,
			receiverPlayerId,
			courtAssignments: courtAssignmentsJson
				? JSON.parse(courtAssignmentsJson)
				: current.courtAssignments
		};
		validateServiceState(service, players);
		return service;
	}

	const service: ServiceState = {
		discipline: 'singles' as const,
		servingSide: servingSide as Side,
		serviceCourt: serviceCourt as ServiceCourt,
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
		throw new Error('サーバーとレシーバーは反対サイドから選択してください');
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
	receiverPlayerId: string
): void {
	const previousGame = state.games.find((game) => game.gameNo === state.currentGameNo - 1);
	if (!previousGame?.winnerSide) return;

	const server = findPlayer(players, serverPlayerId);
	const receiver = findPlayer(players, receiverPlayerId);
	if (server.side !== previousGame.winnerSide) {
		throw new Error('次ゲームの1st サーバーは前ゲーム勝者側から選択してください');
	}
	if (receiver.side !== otherSide(previousGame.winnerSide)) {
		throw new Error('次ゲームの1st レシーバーは前ゲーム敗者側から選択してください');
	}
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
