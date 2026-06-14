import { and, asc, desc, eq } from 'drizzle-orm';
import type { MatchState, ScoreEventInput, Side } from '$lib/domain/types';
import { getRequestDb } from '$lib/server/db/request';
import { scoreEventUndoLinks, scoreEvents } from '$lib/server/db/schema';

export type ScoreEvent = typeof scoreEvents.$inferSelect;

export interface InsertScoreEventParams {
	id: string;
	matchId: string;
	seqNo: number;
	eventType: ScoreEvent['eventType'];
	side?: Side | null;
	gameNo?: number | null;
	beforeState: MatchState;
	afterState: MatchState;
	input: ScoreEventInput;
	targetSeqNo?: number | null;
	reason?: string | null;
	actorName?: string | null;
	createdAt: string;
}

export async function insertScoreEvent(params: InsertScoreEventParams): Promise<void> {
	const db = getRequestDb();
	const beforeGame = params.beforeState.games.find(
		(game) => game.gameNo === params.beforeState.currentGameNo
	);
	const eventGameNo = params.gameNo ?? params.beforeState.currentGameNo;
	const afterGame = params.afterState.games.find((game) => game.gameNo === eventGameNo);

	await db.insert(scoreEvents).values({
		id: params.id,
		matchId: params.matchId,
		seqNo: params.seqNo,
		eventType: params.eventType,
		side: params.side ?? null,
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
		targetSeqNo: params.targetSeqNo ?? null,
		reason: params.reason ?? null,
		payloadJson: JSON.stringify({
			input: params.input,
			beforeState: params.beforeState,
			afterState: params.afterState
		}),
		actorName: params.actorName ?? null,
		idempotencyKey: params.input.idempotencyKey,
		createdAt: params.createdAt
	});
}

export async function getScoreEvents(matchId: string): Promise<ScoreEvent[]> {
	const db = getRequestDb();
	return db
		.select()
		.from(scoreEvents)
		.where(eq(scoreEvents.matchId, matchId))
		.orderBy(asc(scoreEvents.seqNo));
}

export async function getScoreEventBySeqNo(
	matchId: string,
	seqNo: number
): Promise<ScoreEvent | null> {
	const db = getRequestDb();
	const event = await db.query.scoreEvents.findFirst({
		where: and(eq(scoreEvents.matchId, matchId), eq(scoreEvents.seqNo, seqNo))
	});
	return event ?? null;
}

export async function getScoreEventByIdempotencyKey(
	matchId: string,
	idempotencyKey: string
): Promise<ScoreEvent | null> {
	const db = getRequestDb();
	const event = await db.query.scoreEvents.findFirst({
		where: and(eq(scoreEvents.matchId, matchId), eq(scoreEvents.idempotencyKey, idempotencyKey))
	});
	return event ?? null;
}

export async function getLastUndoableScoreEvent(matchId: string): Promise<ScoreEvent | null> {
	const db = getRequestDb();
	const rows = await db
		.select()
		.from(scoreEvents)
		.where(eq(scoreEvents.matchId, matchId))
		.orderBy(desc(scoreEvents.seqNo));

	return (
		rows.find((event) =>
			[
				'rally_won',
				'correction_applied',
				'match_suspended',
				'match_resumed',
				'match_started',
				'game_started'
			].includes(event.eventType)
		) ?? null
	);
}

export async function hasUndoLink(matchId: string, targetSeqNo: number): Promise<boolean> {
	const db = getRequestDb();
	const link = await db.query.scoreEventUndoLinks.findFirst({
		where: and(
			eq(scoreEventUndoLinks.matchId, matchId),
			eq(scoreEventUndoLinks.targetSeqNo, targetSeqNo)
		)
	});
	return Boolean(link);
}

export async function insertUndoLink(params: {
	matchId: string;
	undoEventId: string;
	targetEventId: string;
	targetSeqNo: number;
	createdAt: string;
}): Promise<void> {
	const db = getRequestDb();
	await db.insert(scoreEventUndoLinks).values({
		id: crypto.randomUUID(),
		matchId: params.matchId,
		undoEventId: params.undoEventId,
		targetEventId: params.targetEventId,
		targetSeqNo: params.targetSeqNo,
		createdAt: params.createdAt
	});
}
