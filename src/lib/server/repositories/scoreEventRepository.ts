import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { getRequestDb } from '$lib/server/db/request';
import type { MatchState, ScoreEventInput, Side } from '$lib/domain/types';
import type { RequestDb } from './matchStateStore';
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
	const db = await getRequestDbOrThrow();
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
	const db = await getRequestDbOrThrow();
	return db
		.select()
		.from(scoreEvents)
		.where(eq(scoreEvents.matchId, matchId))
		.orderBy(asc(scoreEvents.seqNo));
}

export async function getScoreEventBySeqNo(
	matchId: string,
	seqNo: number,
	dbParam?: RequestDb
): Promise<ScoreEvent | null> {
	const db = await getRequestDbOrThrow(dbParam);
	const event = await db.query.scoreEvents.findFirst({
		where: and(eq(scoreEvents.matchId, matchId), eq(scoreEvents.seqNo, seqNo))
	});
	return event ?? null;
}

export async function getScoreEventByIdempotencyKey(
	matchId: string,
	idempotencyKey: string,
	dbParam?: RequestDb
): Promise<ScoreEvent | null> {
	const db = await getRequestDbOrThrow(dbParam);
	const event = await db.query.scoreEvents.findFirst({
		where: and(eq(scoreEvents.matchId, matchId), eq(scoreEvents.idempotencyKey, idempotencyKey))
	});
	return event ?? null;
}

const UNDOABLE_EVENT_TYPES = [
	'rally_won',
	'correction_applied',
	'match_suspended',
	'match_resumed',
	'match_started',
	'game_started'
] as const;

const undoableColumns = {
	id: scoreEvents.id,
	matchId: scoreEvents.matchId,
	seqNo: scoreEvents.seqNo,
	eventType: scoreEvents.eventType,
	payloadJson: scoreEvents.payloadJson,
	scoreAAfter: scoreEvents.scoreAAfter,
	scoreBAfter: scoreEvents.scoreBAfter,
	idempotencyKey: scoreEvents.idempotencyKey,
	createdAt: scoreEvents.createdAt
} as const;

export type UndoableScoreEvent = Pick<ScoreEvent, keyof typeof undoableColumns>;

export async function getLastUndoableScoreEvent(
	matchId: string,
	dbParam?: RequestDb
): Promise<UndoableScoreEvent | null> {
	const db = await getRequestDbOrThrow(dbParam);
	// LEFT JOIN + IS NULL で未キャンセルの最新イベントだけを取得する。
	const [row] = await db
		.select(undoableColumns)
		.from(scoreEvents)
		.leftJoin(
			scoreEventUndoLinks,
			and(
				eq(scoreEventUndoLinks.matchId, scoreEvents.matchId),
				eq(scoreEventUndoLinks.targetSeqNo, scoreEvents.seqNo)
			)
		)
		.where(
			and(
				eq(scoreEvents.matchId, matchId),
				inArray(scoreEvents.eventType, UNDOABLE_EVENT_TYPES),
				isNull(scoreEventUndoLinks.targetSeqNo)
			)
		)
		.orderBy(desc(scoreEvents.seqNo))
		.limit(1);
	return row ?? null;
}

export async function hasUndoLink(
	matchId: string,
	targetSeqNo: number,
	dbParam?: RequestDb
): Promise<boolean> {
	const db = await getRequestDbOrThrow(dbParam);
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
	const db = await getRequestDbOrThrow();
	await buildUndoLinkInsert(db, params);
}

async function getRequestDbOrThrow(dbParam?: RequestDb): Promise<RequestDb> {
	if (dbParam) return dbParam;
	return getRequestDb();
}
