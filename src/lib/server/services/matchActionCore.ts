import { applyScoreEvent } from '$lib/domain/scoring';
import { MatchStatePayloadSchema } from '$lib/domain/schemas';
import type { MatchPlayer, MatchState, ScoreEventInput } from '$lib/domain/types';
import * as v from 'valibot';
import { matchSidePlayers, matchSnapshots, matches, rubbers } from '$lib/server/db/schema';
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
import { asc, eq } from 'drizzle-orm';

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

	// db.batch() で複数クエリを1つの D1 HTTP リクエストに統合
	const needsState = !params.beforeState;
	const needsPlayers = !params.players;

	let beforeState: MatchState;
	let players: MatchPlayer[];
	let match: Awaited<ReturnType<typeof db.query.matches.findFirst>>;

	if (needsState || needsPlayers) {
		const queries = [];
		if (needsState)
			queries.push(
				db.query.matchSnapshots.findFirst({ where: eq(matchSnapshots.matchId, matchId) })
			);
		if (needsPlayers)
			queries.push(
				db
					.select()
					.from(matchSidePlayers)
					.where(eq(matchSidePlayers.matchId, matchId))
					.orderBy(asc(matchSidePlayers.side), asc(matchSidePlayers.playerOrder))
			);
		queries.push(db.query.matches.findFirst({ where: eq(matches.id, matchId) }));

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const results: any[] = await (db.batch as any)(queries);
		let r = 0;

		if (needsState) {
			const snapshot = results[r++] as { stateJson: string } | undefined;
			if (!snapshot) throw new Error('Match snapshot not found');
			beforeState = v.parse(MatchStatePayloadSchema, JSON.parse(snapshot.stateJson)) as MatchState;
		} else {
			beforeState = params.beforeState!;
		}

		if (needsPlayers) {
			const rows = results[r++] as Array<{
				id: string;
				side: string;
				playerOrder: number;
				name: string;
				teamName: string | null;
			}>;
			players = rows.map((row) => ({
				id: row.id,
				side: row.side as 'A' | 'B',
				order: row.playerOrder as 1 | 2,
				name: row.name,
				teamName: row.teamName
			}));
		} else {
			players = params.players!;
		}

		match = results[r] as (typeof results)[number];
	} else {
		beforeState = params.beforeState!;
		players = params.players!;
		match = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
	}
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
		const terminalStatuses = new Set([
			'finished',
			'forfeited',
			'retired',
			'confirmed',
			'cancelled'
		]);
		const wasTerminal = terminalStatuses.has(beforeState.status);
		const isTerminal = terminalStatuses.has(afterState.status);
		if (wasTerminal !== isTerminal) {
			const rubber = await db.query.rubbers.findFirst({ where: eq(rubbers.id, match.rubberId) });
			if (rubber) await recalculateTieResult(rubber.tieId, now, db);
		}
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
