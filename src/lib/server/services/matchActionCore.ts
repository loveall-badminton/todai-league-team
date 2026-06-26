import { applyScoreEvent } from '$lib/domain/scoring';
import { MatchStatePayloadSchema } from '$lib/domain/schemas';
import type { MatchPlayer, MatchState, ScoreEventInput } from '$lib/domain/types';
import * as v from 'valibot';
import { matches, rubbers } from '$lib/server/db/schema';
import { getMatchPlayers, getMatchState } from '$lib/server/repositories/matchRepository';
import {
	buildMatchServiceStateUpsert,
	buildMatchSnapshotUpsert,
	buildMatchUpdate,
	buildRubberUpdate,
	buildScoreEventInsert,
	buildUndoLinkInsert,
	type RequestDb
} from '$lib/server/repositories/matchStateStore';
import {
	getLastUndoableScoreEvent,
	getScoreEventByIdempotencyKey,
	getScoreEventBySeqNo,
	hasUndoLink
} from '$lib/server/repositories/scoreEventRepository';
import { recalculateTieResult } from '$lib/server/services/tieOperationService';
import { eq } from 'drizzle-orm';

export type ApplyMatchActionParams = {
	matchId: string;
	input: ScoreEventInput;
	actorName?: string | null;
	now: string;
	beforeState?: MatchState;
	players?: MatchPlayer[];
};

export async function applyMatchActionWithDb(
	db: RequestDb,
	params: ApplyMatchActionParams
): Promise<{ afterState: MatchState; input: ScoreEventInput }> {
	const { matchId, actorName, now } = params;
	const duplicate = await getScoreEventByIdempotencyKey(matchId, params.input.idempotencyKey, db);
	if (duplicate) {
		const payload = parsePayload(duplicate.payloadJson);
		if (payload.afterState) {
			return {
				afterState: payload.afterState,
				input: (payload.input as ScoreEventInput | undefined) ?? params.input
			};
		}
		throw new Error('Duplicate request but afterState is missing from stored payload');
	}

	const beforeState = params.beforeState ?? (await getMatchState(matchId, db));
	const players = params.players ?? (await getMatchPlayers(matchId, db));
	const match = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
	const input = await prepareUndoInput(db, matchId, params.input);
	const afterState = applyScoreEvent({ state: beforeState, input, players, now });
	const eventId = crypto.randomUUID();
	const eventInsert = buildScoreEventInsert(db, {
		eventId,
		matchId,
		input,
		beforeState,
		afterState,
		actorName,
		now
	});
	const matchUpdate = buildMatchUpdate(db, afterState);
	const snapshotUpsert = buildMatchSnapshotUpsert(db, afterState);
	const serviceStateUpsert = buildMatchServiceStateUpsert(db, afterState);
	const rubberUpdate = match?.rubberId
		? buildRubberUpdate(db, match.rubberId, afterState, now)
		: null;

	const ops: Parameters<typeof db.batch>[0] = [
		eventInsert,
		matchUpdate,
		snapshotUpsert,
		serviceStateUpsert
	];
	const extra: (typeof ops)[number][] = [];
	if (rubberUpdate) extra.push(rubberUpdate);
	if (input.type === 'undo' && input.targetSeqNo != null) {
		const targetEvent = await getScoreEventBySeqNo(matchId, input.targetSeqNo, db);
		if (!targetEvent) throw new Error('Undo target event not found after insert');
		extra.push(
			buildUndoLinkInsert(db, {
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
		if (rubber) await recalculateTieResult(rubber.tieId, now, db);
	}

	return { afterState, input };
}

async function prepareUndoInput(
	db: RequestDb,
	matchId: string,
	input: ScoreEventInput
): Promise<ScoreEventInput> {
	if (input.type !== 'undo') return input;

	const targetEvent =
		input.targetSeqNo === undefined
			? await getLastUndoableScoreEvent(matchId, db)
			: await getScoreEventBySeqNo(matchId, input.targetSeqNo, db);
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
	if (await hasUndoLink(matchId, targetEvent.seqNo, db)) {
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

function parsePayload(payloadJson: string): {
	beforeState?: MatchState;
	afterState?: MatchState;
	input?: ScoreEventInput;
} {
	try {
		return v.parse(MatchStatePayloadSchema, JSON.parse(payloadJson)) as {
			beforeState?: MatchState;
			afterState?: MatchState;
			input?: ScoreEventInput;
		};
	} catch {
		return {};
	}
}
