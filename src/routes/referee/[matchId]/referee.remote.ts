import { isConfirmableMatchStatus, isTerminalMatchStatus } from '$lib/domain/matchStatus';
import { form, getRequestEvent } from '$app/server';
import { otherSide } from '$lib/domain/scoring';
import { LetReasonSchema, SideSchema } from '$lib/domain/schemas';
import type { MatchPlayer, MatchState, ScoreEventInput } from '$lib/domain/types';
import { requireRefereeMatchAccess } from '$lib/server/auth/access';
import { notifyLiveBoard, notifyScoreChange } from '$lib/server/realtime/broadcast';
import {
	getMatchPlayers,
	getMatchWithPlayers,
	getMatchState,
	getTieContextForMatch,
	updateMatchResultVerification
} from '$lib/server/repositories/matchRepository';
import {
	applyMatchActionWithRealtime,
	type MatchActionRealtimeResult
} from '$lib/server/services/matchRealtimeActionService';
import { cancelMatchRubber } from '$lib/server/services/tieOperationService';
import * as v from 'valibot';

const sideSchema = SideSchema;

async function applyAction(
	matchId: string,
	buildInput: (
		state: Awaited<ReturnType<typeof getMatchState>>,
		players: MatchPlayer[]
	) => ScoreEventInput
): Promise<{ error: string } | { scorePayload: MatchActionRealtimeResult['scorePayload'] }> {
	await requireRefereeMatchAccess(matchId);
	const state = await getMatchState(matchId);
	const players = await getMatchPlayers(matchId);
	let primary: MatchActionRealtimeResult;
	try {
		const now = new Date().toISOString();
		primary = await applyMatchActionWithRealtime({
			matchId,
			input: buildInput(state, players),
			actorName: null,
			now,
			beforeState: state,
			players
		});
	} catch (err) {
		return { error: err instanceof Error ? err.message : '操作に失敗しました' };
	}

	await broadcastScoreUpdate(matchId, primary.scorePayload);
	// クライアントはこの payload をローカル適用する(load 再実行を避ける)
	return { scorePayload: primary.scorePayload };
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
		gameNo: v.pipe(v.string(), v.toNumber(), v.integer()),
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
	await broadcastScoreUpdate(matchId, { state: afterState, event: { type: 'cutoff' } });
});

export const saveRefereeName = form(
	v.object({ refereeName: v.pipe(v.string(), v.trim(), v.nonEmpty()) }),
	async ({ refereeName }) => {
		const event = getRequestEvent();
		const matchId = event.params.matchId!;
		await requireRefereeMatchAccess(matchId);
		const state = await getMatchState(matchId);
		if (!isConfirmableMatchStatus(state.status)) {
			return { error: '試合終了後に入力してください' };
		}
		await updateMatchResultVerification(matchId, {
			refereeName,
			updatedAt: new Date().toISOString()
		});
	}
);

export const confirmWinner = form(async () => {
	const event = getRequestEvent();
	const matchId = event.params.matchId!;
	await requireRefereeMatchAccess(matchId);
	const [state, match] = await Promise.all([getMatchState(matchId), getMatchWithPlayers(matchId)]);
	if (!match) return { error: '試合が見つかりません' };
	if (!isConfirmableMatchStatus(state.status)) {
		return { error: '試合終了後に確認してください' };
	}
	if (!state.winnerSide) {
		return { error: '勝者が未確定の試合は確認できません' };
	}
	if (!match.match.refereeName?.trim()) {
		return { error: '先に審判名を入力してください' };
	}
	await updateMatchResultVerification(matchId, {
		winnerConfirmedAt: new Date().toISOString(),
		winnerConfirmedBySide: state.winnerSide,
		updatedAt: new Date().toISOString()
	});
	const afterState = await getMatchState(matchId);
	await broadcastScoreUpdate(matchId, {
		state: afterState,
		event: { type: 'winner_confirmed' } as const
	});
});

export const unconfirmWinner = form(async () => {
	const event = getRequestEvent();
	const matchId = event.params.matchId!;
	await requireRefereeMatchAccess(matchId);
	const [state, match] = await Promise.all([getMatchState(matchId), getMatchWithPlayers(matchId)]);
	if (!match) return { error: '試合が見つかりません' };
	if (state.status === 'confirmed') {
		return { error: '運営承認後は勝者確認を取り消せません' };
	}
	if (!match.match.winnerConfirmedAt) {
		return { error: 'まだ勝者確認されていません' };
	}
	await updateMatchResultVerification(matchId, {
		winnerConfirmedAt: null,
		winnerConfirmedBySide: null,
		updatedAt: new Date().toISOString()
	});
	const afterState = await getMatchState(matchId);
	await broadcastScoreUpdate(matchId, {
		state: afterState,
		event: { type: 'winner_unconfirmed' } as const
	});
});

async function broadcastScoreUpdate(
	matchId: string,
	score:
		| MatchActionRealtimeResult['scorePayload']
		| { state: MatchState; event: { type: 'cutoff' | 'winner_confirmed' | 'winner_unconfirmed' } }
) {
	notifyScoreChange(matchId, ['score'], { score });
	// 試合が終局すると tie の対戦スコアや順位が変わるため、score を購読しない
	// ボード・順位表ページにも refresh を促す。payload なしだと全クライアントが
	// 一斉 refresh するため、tie を特定して関係ページだけに絞る
	if (isTerminalMatchStatus(score.state.status)) {
		const context = await getTieContextForMatch(matchId).catch(() => null);
		if (context) {
			notifyLiveBoard(['schedule', 'standings'], {
				schedule: {
					tieIds: [context.tieId],
					phases: [context.phase],
					scopes: ['tie_header', 'rubbers']
				},
				standings: { tieIds: [context.tieId] }
			});
		} else {
			notifyLiveBoard(['schedule', 'standings']);
		}
	}
}

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
