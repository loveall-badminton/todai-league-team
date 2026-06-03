import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
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
import { getRequestDb } from '$lib/server/db/request';
import {
	getMatchPlayers,
	getMatchState,
	getMatchWithPlayers
} from '$lib/server/repositories/matchRepository';
import { getScoreEvents } from '$lib/server/repositories/scoreEventRepository';
import { applyMatchAction } from '$lib/server/services/matchActionService';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = getRequestDb(platform);
	const match = await getMatchWithPlayers(db, params.matchId);
	if (!match) error(404, 'Match not found');

	return {
		...match,
		state: await getMatchState(db, params.matchId),
		events: await getScoreEvents(db, params.matchId)
	};
};

export const actions: Actions = {
	start: async (event) =>
		apply(event, (state, formData, players) => {
			const initialServerPlayerId = text(formData, 'initialServerPlayerId');
			const initialReceiverPlayerId = text(formData, 'initialReceiverPlayerId');
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
		}),

	startGame: async (event) =>
		apply(event, (state, formData, players) => {
			const initialServerPlayerId = text(formData, 'initialServerPlayerId');
			const initialReceiverPlayerId = text(formData, 'initialReceiverPlayerId');
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
				gameNo: Number(formData.get('gameNo')),
				initialServerPlayerId,
				initialReceiverPlayerId
			};
		}),

	rallyWon: async (event) =>
		apply(event, (state, formData) => ({
			type: 'rally_won',
			idempotencyKey: crypto.randomUUID(),
			observedSeqNo: state.lastSeqNo,
			side: text(formData, 'side') as Side
		})),

	undo: async (event) =>
		apply(event, (state, formData) => ({
			type: 'undo',
			idempotencyKey: crypto.randomUUID(),
			observedSeqNo: state.lastSeqNo,
			targetSeqNo: optionalNumber(formData, 'targetSeqNo'),
			reason: text(formData, 'reason') || undefined
		})),

	correction: async (event) =>
		apply(event, (state, formData, players) => {
			const reason = text(formData, 'reason');
			if (!reason) throw new Error('訂正理由は必須です');
			return {
				type: 'correction',
				idempotencyKey: crypto.randomUUID(),
				observedSeqNo: state.lastSeqNo,
				gameNo: Number(formData.get('gameNo')),
				score: {
					A: Number(formData.get('scoreA')),
					B: Number(formData.get('scoreB'))
				},
				service: parseService(formData, state.service, players),
				reason
			};
		}),

	letCalled: async (event) =>
		apply(event, (state, formData) => ({
			type: 'let_called',
			idempotencyKey: crypto.randomUUID(),
			observedSeqNo: state.lastSeqNo,
			reason: (text(formData, 'reason') || 'other') as ScoreEventInput extends infer T
				? T extends { type: 'let_called'; reason: infer R }
					? R
					: never
				: never,
			note: text(formData, 'note') || undefined
		})),

	suspend: async (event) =>
		apply(event, (state, formData) => ({
			type: 'match_suspended',
			idempotencyKey: crypto.randomUUID(),
			observedSeqNo: state.lastSeqNo,
			reason: (text(formData, 'reason') || 'other') as 'other',
			note: text(formData, 'note') || undefined
		})),

	resume: async (event) =>
		apply(event, (state, formData) => ({
			type: 'match_resumed',
			idempotencyKey: crypto.randomUUID(),
			observedSeqNo: state.lastSeqNo,
			note: text(formData, 'note') || undefined
		})),

	forfeit: async (event) =>
		apply(event, (state, formData) => ({
			type: 'side_forfeited',
			idempotencyKey: crypto.randomUUID(),
			observedSeqNo: state.lastSeqNo,
			side: text(formData, 'side') as Side,
			reason: 'withdrawal'
		})),

	retire: async (event) =>
		apply(event, (state, formData) => ({
			type: 'side_retired',
			idempotencyKey: crypto.randomUUID(),
			observedSeqNo: state.lastSeqNo,
			side: text(formData, 'side') as Side,
			reason: 'injury'
		})),

	confirm: async (event) =>
		apply(event, (state) => ({
			type: 'match_confirmed',
			idempotencyKey: crypto.randomUUID(),
			observedSeqNo: state.lastSeqNo
		}))
};

async function apply(
	event: Parameters<Actions[string]>[0],
	buildInput: (
		state: Awaited<ReturnType<typeof getMatchState>>,
		formData: FormData,
		players: MatchPlayer[]
	) => ScoreEventInput
) {
	const db = getRequestDb(event.platform);
	const state = await getMatchState(db, event.params.matchId);
	const players = await getMatchPlayers(db, event.params.matchId);
	const formData = await event.request.formData();

	try {
		await applyMatchAction({
			db,
			matchId: event.params.matchId,
			input: buildInput(state, formData, players),
			actorName: null,
			now: new Date().toISOString()
		});
		return { message: '保存しました' };
	} catch (err) {
		return fail(400, { message: err instanceof Error ? err.message : '操作に失敗しました' });
	}
}

function parseService(
	formData: FormData,
	current: ServiceState | null,
	players: MatchPlayer[]
): ServiceState | undefined {
	const servingSide = text(formData, 'servingSide');
	const serviceCourt = text(formData, 'serviceCourt');
	const serverPlayerId = text(formData, 'serverPlayerId');
	const receiverPlayerId = text(formData, 'receiverPlayerId');
	if (!servingSide && !serviceCourt && !serverPlayerId && !receiverPlayerId) return undefined;
	if (!servingSide || !serviceCourt || !serverPlayerId || !receiverPlayerId) {
		throw new Error('サービス状態を訂正する場合は全項目が必須です');
	}

	if (current?.discipline === 'doubles') {
		const courtAssignmentsJson = text(formData, 'courtAssignmentsJson');
		const service = {
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

	const service = {
		discipline: 'singles' as const,
		servingSide: servingSide as Side,
		serviceCourt: serviceCourt as ServiceCourt,
		serverPlayerId,
		receiverPlayerId
	};
	validateServiceState(service, players);
	return service;
}

function text(formData: FormData, key: string): string {
	return String(formData.get(key) ?? '').trim();
}

function optionalNumber(formData: FormData, key: string): number | undefined {
	const value = text(formData, key);
	if (!value) return undefined;
	const number = Number(value);
	return Number.isFinite(number) ? number : undefined;
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
		throw new Error('次ゲームの初期サーバーは前ゲーム勝者側から選択してください');
	}
	if (receiver.side !== otherSide(previousGame.winnerSide)) {
		throw new Error('次ゲームの初期レシーバーは前ゲーム敗者側から選択してください');
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
