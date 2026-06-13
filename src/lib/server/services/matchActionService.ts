import { applyScoreEvent, getCurrentGame } from '$lib/domain/scoring';
import type { GameScore, MatchState, ScoreEventInput, ServiceState } from '$lib/domain/types';
import type { AppDb } from '$lib/server/db/client';
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
	db: AppDb;
	matchId: string;
	input: ScoreEventInput;
	actorName?: string | null;
	now: string;
}): Promise<MatchState> {
	const { db, matchId, actorName, now } = params;
	const duplicate = await getScoreEventByIdempotencyKey(db, matchId, params.input.idempotencyKey);
	if (duplicate) {
		const payload = parsePayload(duplicate.payloadJson);
		if (payload.afterState) return payload.afterState;
	}

	const beforeState = await getMatchState(db, matchId);
	const match = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
	const players = await getMatchPlayers(db, matchId);
	const input = await prepareUndoInput(db, matchId, params.input);
	const afterState = applyScoreEvent({ state: beforeState, input, players, now });
	const eventId = crypto.randomUUID();
	const eventInsert = buildScoreEventInsert({
		db,
		eventId,
		matchId,
		input,
		beforeState,
		afterState,
		actorName,
		now
	});
	const matchUpdate = buildMatchUpdate(db, afterState);
	const snapshotUpsert = buildSnapshotUpsert(db, afterState);
	const serviceStateUpsert = buildServiceStateUpsert(db, afterState);
	const rubberUpdate = match?.rubberId
		? buildRubberUpdate(db, match.rubberId, afterState, now)
		: null;

	if (input.type === 'undo' && input.targetSeqNo) {
		const targetEvent = await getScoreEventBySeqNo(db, matchId, input.targetSeqNo);
		if (!targetEvent) throw new Error('Undo target event not found after insert');
		const undoLinkInsert = db.insert(scoreEventUndoLinks).values({
			id: crypto.randomUUID(),
			matchId,
			undoEventId: eventId,
			targetEventId: targetEvent.id,
			targetSeqNo: input.targetSeqNo,
			createdAt: now
		});
		if (rubberUpdate) {
			await db.batch([
				eventInsert,
				matchUpdate,
				snapshotUpsert,
				serviceStateUpsert,
				rubberUpdate,
				undoLinkInsert
			] as const);
		} else {
			await db.batch([
				eventInsert,
				matchUpdate,
				snapshotUpsert,
				serviceStateUpsert,
				undoLinkInsert
			] as const);
		}
	} else {
		if (rubberUpdate) {
			await db.batch([
				eventInsert,
				matchUpdate,
				snapshotUpsert,
				serviceStateUpsert,
				rubberUpdate
			] as const);
		} else {
			await db.batch([eventInsert, matchUpdate, snapshotUpsert, serviceStateUpsert] as const);
		}
	}

	if (match?.rubberId) {
		const rubber = await db.query.rubbers.findFirst({ where: eq(rubbers.id, match.rubberId) });
		if (rubber) await recalculateTieResult(db, rubber.tieId, now);
	}

	return afterState;
}

async function prepareUndoInput(
	db: AppDb,
	matchId: string,
	input: ScoreEventInput
): Promise<ScoreEventInput> {
	if (input.type !== 'undo') return input;

	const targetEvent =
		input.targetSeqNo === undefined
			? await getLastUndoableScoreEvent(db, matchId)
			: await getScoreEventBySeqNo(db, matchId, input.targetSeqNo);
	if (!targetEvent) throw new Error('Undo target event not found');
	if (
		!['rally_won', 'correction_applied', 'match_suspended', 'match_resumed'].includes(
			targetEvent.eventType
		)
	) {
		throw new Error('Event cannot be undone');
	}
	if (await hasUndoLink(db, matchId, targetEvent.seqNo)) {
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
		return JSON.parse(payloadJson) as { beforeState?: MatchState; afterState?: MatchState };
	} catch {
		return {};
	}
}

function eventTypeForInput(input: ScoreEventInput) {
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
	db: AppDb;
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
		db: AppDb;
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
	return params.db.insert(scoreEvents).values({
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

function buildMatchUpdate(db: AppDb, state: MatchState) {
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
			actualEndAt: state.winnerSide ? state.updatedAt : undefined,
			updatedAt: state.updatedAt
		})
		.where(eq(matches.id, state.matchId));
}

function buildRubberUpdate(db: AppDb, rubberId: string, state: MatchState, now: string) {
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

function buildSnapshotUpsert(db: AppDb, state: MatchState) {
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

function buildServiceStateUpsert(db: AppDb, state: MatchState) {
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
