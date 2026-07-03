import { getCurrentGame } from '$lib/domain/scoring';
import { isResultMatchStatus, rubberStatusForMatchStatus } from '$lib/domain/matchStatus';
import { eventTypeForInput } from '$lib/domain/scoreEvents';
import type { MatchState, ScoreEventInput, ServiceState } from '$lib/domain/types';
import { getDb } from '$lib/server/db';
import {
	matchServiceStates,
	matchSnapshots,
	matches,
	rubbers,
	scoreEventUndoLinks,
	scoreEvents
} from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export type RequestDb = ReturnType<typeof getDb>;

type ScoreEventType = (typeof scoreEvents.$inferSelect)['eventType'];

export function buildScoreEventInsert(
	db: RequestDb,
	params: {
		eventId: string;
		matchId: string;
		input: ScoreEventInput;
		beforeState: MatchState;
		afterState: MatchState;
		actorName?: string | null;
		now: string;
		seqNo?: number;
		eventType?: ScoreEventType;
		side?: (typeof scoreEvents.$inferSelect)['side'];
		gameNo?: number | null;
		targetSeqNo?: number | null;
		reason?: string | null;
	}
) {
	const beforeGame = params.beforeState.games.find(
		(game) => game.gameNo === params.beforeState.currentGameNo
	);
	const eventGameNo =
		params.gameNo ??
		('gameNo' in params.input ? params.input.gameNo : params.beforeState.currentGameNo);
	const afterGame = params.afterState.games.find((game) => game.gameNo === eventGameNo);

	return db.insert(scoreEvents).values({
		id: params.eventId,
		matchId: params.matchId,
		seqNo: params.seqNo ?? params.afterState.lastSeqNo,
		eventType: params.eventType ?? eventTypeForInput(params.input),
		side: params.side ?? ('side' in params.input ? params.input.side : null),
		gameNo: eventGameNo,
		scoreABefore: beforeGame?.score.A ?? null,
		scoreBBefore: beforeGame?.score.B ?? null,
		scoreAAfter: afterGame?.score.A ?? null,
		scoreBAfter: afterGame?.score.B ?? null,
		servingSideBefore: params.beforeState.service?.servingSide ?? null,
		serviceCourtBefore: params.beforeState.service?.serviceCourt ?? null,
		serverPlayerIdBefore: params.beforeState.service?.serverPlayerId ?? null,
		receiverPlayerIdBefore: params.beforeState.service?.receiverPlayerId ?? null,
		servingSideAfter: params.afterState.service?.servingSide ?? null,
		serviceCourtAfter: params.afterState.service?.serviceCourt ?? null,
		serverPlayerIdAfter: params.afterState.service?.serverPlayerId ?? null,
		receiverPlayerIdAfter: params.afterState.service?.receiverPlayerId ?? null,
		targetSeqNo:
			params.targetSeqNo ??
			(params.input.type === 'undo' ? (params.input.targetSeqNo ?? null) : null),
		reason: params.reason ?? reasonForInput(params.input),
		payloadJson: JSON.stringify(
			buildEventPayload(params.input, params.beforeState, params.afterState)
		),
		actorName: params.actorName ?? null,
		idempotencyKey: params.input.idempotencyKey,
		createdAt: params.now
	});
}

function buildEventPayload(
	input: ScoreEventInput,
	beforeState: MatchState,
	afterState: MatchState
) {
	const payload = {
		input,
		beforeSummary: stateSummary(beforeState),
		afterSummary: stateSummary(afterState),
		afterState
	};

	if (needsUndoRestoreState(input)) {
		return { ...payload, beforeState };
	}

	return payload;
}

function needsUndoRestoreState(input: ScoreEventInput): boolean {
	return input.type !== 'rally_won';
}

export function buildUndoLinkInsert(
	db: RequestDb,
	params: {
		matchId: string;
		undoEventId: string;
		targetEventId: string;
		targetSeqNo: number;
		createdAt: string;
	}
) {
	return db.insert(scoreEventUndoLinks).values({
		id: crypto.randomUUID(),
		matchId: params.matchId,
		undoEventId: params.undoEventId,
		targetEventId: params.targetEventId,
		targetSeqNo: params.targetSeqNo,
		createdAt: params.createdAt
	});
}

export function buildMatchUpdate(db: RequestDb, state: MatchState) {
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
			actualEndAt: isResultMatchStatus(state.status) ? state.updatedAt : undefined,
			updatedAt: state.updatedAt
		})
		.where(eq(matches.id, state.matchId));
}

export function buildRubberUpdate(db: RequestDb, rubberId: string, state: MatchState, now: string) {
	const status = rubberStatusForMatchStatus(state.status);
	// scheduled への巻き戻しや cancelled はスコアイベント以外の操作で扱うため、ここでは更新しない
	if (status !== 'confirmed' && status !== 'finished' && status !== 'playing') return null;

	return db
		.update(rubbers)
		.set({
			status,
			winnerSide: state.winnerSide,
			updatedAt: now
		})
		.where(eq(rubbers.id, rubberId));
}

export function buildMatchSnapshotUpsert(db: RequestDb, state: MatchState) {
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

export function buildMatchServiceStateUpsert(db: RequestDb, state: MatchState) {
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

function reasonForInput(input: ScoreEventInput): string | null {
	if ('reason' in input) return String(input.reason ?? '') || null;
	if ('note' in input) return input.note ?? null;
	return null;
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
