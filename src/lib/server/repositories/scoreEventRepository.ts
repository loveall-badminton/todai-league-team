import { and, asc, desc, eq } from 'drizzle-orm';
import type { MatchState, ScoreEventInput, Side } from '$lib/domain/types';
import { getRequestDb } from '$lib/server/db/request';
import { scoreEventUndoLinks, scoreEvents } from '$lib/server/db/schema';
import { buildScoreEventInsert, buildUndoLinkInsert } from './matchStateStore';

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
	await buildScoreEventInsert(db, {
		eventId: params.id,
		matchId: params.matchId,
		input: params.input,
		beforeState: params.beforeState,
		afterState: params.afterState,
		actorName: params.actorName,
		now: params.createdAt,
		seqNo: params.seqNo,
		eventType: params.eventType,
		side: params.side,
		gameNo: params.gameNo,
		targetSeqNo: params.targetSeqNo,
		reason: params.reason
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
	const [rows, undoneLinks] = await Promise.all([
		db
			.select()
			.from(scoreEvents)
			.where(eq(scoreEvents.matchId, matchId))
			.orderBy(desc(scoreEvents.seqNo)),
		db
			.select({ targetSeqNo: scoreEventUndoLinks.targetSeqNo })
			.from(scoreEventUndoLinks)
			.where(eq(scoreEventUndoLinks.matchId, matchId))
	]);

	const undoneSeqNos = new Set(undoneLinks.map((r) => r.targetSeqNo));

	return (
		rows.find(
			(event) =>
				[
					'rally_won',
					'correction_applied',
					'match_suspended',
					'match_resumed',
					'match_started',
					'game_started'
				].includes(event.eventType) && !undoneSeqNos.has(event.seqNo)
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
	await buildUndoLinkInsert(db, params);
}
