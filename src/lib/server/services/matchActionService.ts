import { applyScoreEvent, getCurrentGame } from '$lib/domain/scoring';
import { MatchStatePayloadSchema } from '$lib/domain/schemas';
import type {
	GameScore,
	MatchPlayer,
	MatchState,
	ScoreEventInput,
	ServiceState
} from '$lib/domain/types';
import * as v from 'valibot';
import { getRequestDb } from '$lib/server/db/request';
import {
	matchServiceStates,
	matchSnapshots,
	matches,
	rubbers,
	scoreEventUndoLinks,
	scoreEvents
} from '$lib/server/db/schema';
import { getMatchPlayers, getMatchState } from '$lib/server/repositories/matchRepository';
import {
	getLastUndoableScoreEvent,
	getScoreEventByIdempotencyKey,
	getScoreEventBySeqNo,
	hasUndoLink
} from '$lib/server/repositories/scoreEventRepository';
import { recalculateTieResult } from '$lib/server/services/tieOperationService';
import { eq } from 'drizzle-orm';

export async function applyMatchAction(params: {
	matchId: string;
	input: ScoreEventInput;
	actorName?: string | null;
	now: string;
	/** Pre-fetched state to avoid duplicate query (caller may already have it) */
	beforeState?: MatchState;
	/** Pre-fetched players to avoid duplicate query */
	players?: MatchPlayer[];
}): Promise<MatchState> {
	const db = getRequestDb();
	const { matchId, actorName, now } = params;
	const duplicate = await getScoreEventByIdempotencyKey(matchId, params.input.idempotencyKey);
	if (duplicate) {
		const payload = parsePayload(duplicate.payloadJson);
		if (payload.afterState) return payload.afterState;
		throw new Error('Duplicate request but afterState is missing from stored payload');
	}

	const beforeState = params.beforeState ?? (await getMatchState(matchId));
	const players = params.players ?? (await getMatchPlayers(matchId));
	const match = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
	const input = await prepareUndoInput(matchId, params.input);
	const afterState = applyScoreEvent({ state: beforeState, input, players, now });
	const eventId = crypto.randomUUID();
	const eventInsert = buildScoreEventInsert({
		eventId,
		matchId,
		input,
		beforeState,
		afterState,
		actorName,
		now
	});
	const matchUpdate = buildMatchUpdate(afterState);
	const snapshotUpsert = buildSnapshotUpsert(afterState);
	const serviceStateUpsert = buildServiceStateUpsert(afterState);
	const rubberUpdate = match?.rubberId ? buildRubberUpdate(match.rubberId, afterState, now) : null;

	const ops: Parameters<typeof db.batch>[0] = [
		eventInsert,
		matchUpdate,
		snapshotUpsert,
		serviceStateUpsert
	];
	const extra: (typeof ops)[number][] = [];
	if (rubberUpdate) extra.push(rubberUpdate);
	if (input.type === 'undo' && input.targetSeqNo != null) {
		const targetEvent = await getScoreEventBySeqNo(matchId, input.targetSeqNo);
		if (!targetEvent) throw new Error('Undo target event not found after insert');
		extra.push(
			db.insert(scoreEventUndoLinks).values({
				id: crypto.randomUUID(),
				matchId,
				undoEventId: eventId,
				targetEventId: targetEvent.id,
				targetSeqNo: input.targetSeqNo,
				createdAt: now
			})
		);
	}
	await db.batch([...ops, ...extra]);

	if (match?.rubberId) {
		const rubber = await db.query.rubbers.findFirst({ where: eq(rubbers.id, match.rubberId) });
		if (rubber) await recalculateTieResult(rubber.tieId, now);
	}

	return afterState;
}

async function prepareUndoInput(matchId: string, input: ScoreEventInput): Promise<ScoreEventInput> {
	if (input.type !== 'undo') return input;

	const targetEvent =
		input.targetSeqNo === undefined
			? await getLastUndoableScoreEvent(matchId)
			: await getScoreEventBySeqNo(matchId, input.targetSeqNo);
	if (!targetEvent) throw new Error('Undo target event not found');
	if (
		![
			'rally_won',
			'correction_applied',
			'match_suspended',
			'match_resumed',
			'match_started',
			'game_started'
		].includes(targetEvent.eventType)
	) {
		throw new Error('Event cannot be undone');
	}
	if (
		['match_started', 'game_started'].includes(targetEvent.eventType) &&
		(targetEvent.scoreAAfter !== 0 || targetEvent.scoreBAfter !== 0)
	) {
		throw new Error('得点が記録されているため修正できません');
	}
	if (await hasUndoLink(matchId, targetEvent.seqNo)) {
		throw new Error('Target event has already been undone');
	}

	const payload = parsePayload(targetEvent.payloadJson);
	if (!payload.beforeState) throw new Error('Undo target does not contain beforeState');
	return {
		...input,
		targetSeqNo: targetEvent.seqNo,
		restoreState: payload.beforeState
	};
}

function parsePayload(payloadJson: string): { beforeState?: MatchState; afterState?: MatchState } {
	try {
		return v.parse(MatchStatePayloadSchema, JSON.parse(payloadJson));
	} catch {
		return {};
	}
}

export function eventTypeForInput(input: ScoreEventInput) {
	if (input.type === 'undo') return 'undo_applied';
	if (input.type === 'correction') return 'correction_applied';
	return input.type;
}

function reasonForInput(input: ScoreEventInput): string | null {
	if ('reason' in input) return String(input.reason ?? '') || null;
	if ('note' in input) return input.note ?? null;
	return null;
}

function buildScoreEventInsert(params: {
	eventId: string;
	matchId: string;
	input: ScoreEventInput;
	beforeState: MatchState;
	afterState: MatchState;
	actorName?: string | null;
	now: string;
}) {
	const beforeGame = params.beforeState.games.find(
		(game) => game.gameNo === params.beforeState.currentGameNo
	);
	// Use the same gameNo the event is attributed to (beforeState.currentGameNo for rally_won
	// etc., or input.gameNo for game_started). When a rally wins a game, afterState.currentGameNo
	// has already advanced to the next game whose score is 0-0, so we must NOT use it here.
	const eventGameNo =
		'gameNo' in params.input ? params.input.gameNo : params.beforeState.currentGameNo;
	const afterGame = params.afterState.games.find((game) => game.gameNo === eventGameNo);

	return scoreEventsInsert(params, beforeGame?.score ?? null, afterGame?.score ?? null);
}

function scoreEventsInsert(
	params: {
		eventId: string;
		matchId: string;
		input: ScoreEventInput;
		beforeState: MatchState;
		afterState: MatchState;
		actorName?: string | null;
		now: string;
	},
	beforeScore: GameScore | null,
	afterScore: GameScore | null
) {
	const db = getRequestDb();
	return db.insert(scoreEvents).values({
		id: params.eventId,
		matchId: params.matchId,
		seqNo: params.afterState.lastSeqNo,
		eventType: eventTypeForInput(params.input),
		side: 'side' in params.input ? params.input.side : null,
		gameNo: 'gameNo' in params.input ? params.input.gameNo : params.beforeState.currentGameNo,
		scoreABefore: beforeScore?.A ?? null,
		scoreBBefore: beforeScore?.B ?? null,
		scoreAAfter: afterScore?.A ?? null,
		scoreBAfter: afterScore?.B ?? null,
		servingSideBefore: params.beforeState.service?.servingSide ?? null,
		serviceCourtBefore: params.beforeState.service?.serviceCourt ?? null,
		serverPlayerIdBefore: params.beforeState.service?.serverPlayerId ?? null,
		receiverPlayerIdBefore: params.beforeState.service?.receiverPlayerId ?? null,
		servingSideAfter: params.afterState.service?.servingSide ?? null,
		serviceCourtAfter: params.afterState.service?.serviceCourt ?? null,
		serverPlayerIdAfter: params.afterState.service?.serverPlayerId ?? null,
		receiverPlayerIdAfter: params.afterState.service?.receiverPlayerId ?? null,
		targetSeqNo: params.input.type === 'undo' ? (params.input.targetSeqNo ?? null) : null,
		reason: reasonForInput(params.input),
		payloadJson: JSON.stringify({
			input: params.input,
			beforeSummary: stateSummary(params.beforeState),
			afterSummary: stateSummary(params.afterState),
			beforeState: params.beforeState,
			afterState: params.afterState
		}),
		actorName: params.actorName ?? null,
		idempotencyKey: params.input.idempotencyKey,
		createdAt: params.now
	});
}

function buildMatchUpdate(state: MatchState) {
	const db = getRequestDb();
	const currentGame = getCurrentGame(state);
	return db
		.update(matches)
		.set({
			status: state.status,
			currentGameNo: state.currentGameNo,
			currentScoreA: currentGame.score.A,
			currentScoreB: currentGame.score.B,
			gamesWonA: state.gamesWon.A,
			gamesWonB: state.gamesWon.B,
			winnerSide: state.winnerSide,
			currentServingSide: state.service?.servingSide ?? null,
			currentServiceCourt: state.service?.serviceCourt ?? null,
			currentServerPlayerId: state.service?.serverPlayerId ?? null,
			currentReceiverPlayerId: state.service?.receiverPlayerId ?? null,
			lastSeqNo: state.lastSeqNo,
			actualStartAt:
				state.lastSeqNo === 1 && state.status === 'playing' ? state.updatedAt : undefined,
			actualEndAt: ['finished', 'forfeited', 'retired', 'confirmed'].includes(state.status)
				? state.updatedAt
				: undefined,
			updatedAt: state.updatedAt
		})
		.where(eq(matches.id, state.matchId));
}

function buildRubberUpdate(rubberId: string, state: MatchState, now: string) {
	const db = getRequestDb();
	const activeStatuses = new Set(['playing', 'interval', 'suspended']);
	const finishedStatuses = new Set(['finished', 'forfeited', 'retired']);
	const status =
		state.status === 'confirmed'
			? 'confirmed'
			: finishedStatuses.has(state.status)
				? 'finished'
				: activeStatuses.has(state.status)
					? 'playing'
					: null;

	if (!status) {
		return db.update(rubbers).set({ updatedAt: now }).where(eq(rubbers.id, rubberId));
	}

	return db
		.update(rubbers)
		.set({
			status,
			winnerSide: state.winnerSide,
			updatedAt: now
		})
		.where(eq(rubbers.id, rubberId));
}

function buildSnapshotUpsert(state: MatchState) {
	const db = getRequestDb();
	return db
		.insert(matchSnapshots)
		.values({
			matchId: state.matchId,
			seqNo: state.lastSeqNo,
			stateJson: JSON.stringify(state),
			updatedAt: state.updatedAt
		})
		.onConflictDoUpdate({
			target: matchSnapshots.matchId,
			set: {
				seqNo: state.lastSeqNo,
				stateJson: JSON.stringify(state),
				updatedAt: state.updatedAt
			}
		});
}

function buildServiceStateUpsert(state: MatchState) {
	const db = getRequestDb();
	return db
		.insert(matchServiceStates)
		.values(serviceStateValues(state))
		.onConflictDoUpdate({
			target: matchServiceStates.matchId,
			set: serviceStateValues(state)
		});
}

function serviceStateValues(state: MatchState) {
	return {
		matchId: state.matchId,
		gameNo: state.currentGameNo,
		servingSide: state.service?.servingSide ?? null,
		serviceCourt: state.service?.serviceCourt ?? null,
		serverPlayerId: state.service?.serverPlayerId ?? null,
		receiverPlayerId: state.service?.receiverPlayerId ?? null,
		courtAssignmentsJson:
			state.service?.discipline === 'doubles'
				? JSON.stringify(state.service.courtAssignments)
				: '{}',
		updatedAt: state.updatedAt
	};
}

function stateSummary(state: MatchState) {
	const game = getCurrentGame(state);
	return {
		status: state.status,
		currentGameNo: state.currentGameNo,
		score: game.score,
		gamesWon: state.gamesWon,
		winnerSide: state.winnerSide,
		terminalReason: state.terminalReason,
		service: serviceSummary(state.service),
		lastSeqNo: state.lastSeqNo
	};
}

function serviceSummary(service: ServiceState | null) {
	if (!service) return null;
	return {
		discipline: service.discipline,
		servingSide: service.servingSide,
		serviceCourt: service.serviceCourt,
		serverPlayerId: service.serverPlayerId,
		receiverPlayerId: service.receiverPlayerId
	};
}
