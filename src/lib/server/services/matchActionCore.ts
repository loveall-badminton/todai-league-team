import { applyScoreEvent } from '$lib/domain/scoring';
import { MatchStateSchema, ScoreEventInputSchema } from '$lib/domain/schemas';
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
	const { matchId, input: rawInput } = params;
	try {
		return await applyMatchActionWithDbImpl(db, params);
	} catch (err) {
		throw new Error(
			`[matchAction:${matchId}/${rawInput.type}] ${err instanceof Error ? err.message : String(err)}`,
			{ cause: err }
		);
	}
}

async function applyMatchActionWithDbImpl(
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
				input: payload.input ?? params.input
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

	function toMatchPlayer(row: {
		id: string;
		side: 'A' | 'B';
		playerOrder: number;
		name: string;
		teamName: string | null;
	}): MatchPlayer {
		if (row.playerOrder !== 1 && row.playerOrder !== 2) {
			throw new Error(`Invalid player order: ${row.playerOrder}`);
		}

		return {
			id: row.id,
			side: row.side,
			order: row.playerOrder,
			name: row.name,
			teamName: row.teamName
		};
	}

	if (needsState || needsPlayers) {
		const snapshotQuery = db.query.matchSnapshots.findFirst({
			where: eq(matchSnapshots.matchId, matchId)
		});
		const playersQuery = db
			.select()
			.from(matchSidePlayers)
			.where(eq(matchSidePlayers.matchId, matchId))
			.orderBy(asc(matchSidePlayers.side), asc(matchSidePlayers.playerOrder));
		const matchQuery = db.query.matches.findFirst({ where: eq(matches.id, matchId) });

		if (needsState && needsPlayers) {
			const [snapshot, rows, matchRow] = await db.batch([snapshotQuery, playersQuery, matchQuery]);
			if (!snapshot) throw new Error('Match snapshot not found');
			beforeState = v.parse(MatchStateSchema, JSON.parse(snapshot.stateJson));
			players = rows.map(toMatchPlayer);
			match = matchRow;
		} else if (needsState) {
			const [snapshot, matchRow] = await db.batch([snapshotQuery, matchQuery]);
			if (!snapshot) throw new Error('Match snapshot not found');
			beforeState = v.parse(MatchStateSchema, JSON.parse(snapshot.stateJson));
			players = params.players!;
			match = matchRow;
		} else {
			const [rows, matchRow] = await db.batch([playersQuery, matchQuery]);
			beforeState = params.beforeState!;
			players = rows.map(toMatchPlayer);
			match = matchRow;
		}
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
		// rubbers.status は playing/interval/suspended をまとめて 'playing' として扱うため、
		// この境界をまたぐタイミングでも tie の進行中判定を再計算する必要がある。
		const activeStatuses = new Set(['playing', 'interval', 'suspended']);
		const wasActive = activeStatuses.has(beforeState.status);
		const isActive = activeStatuses.has(afterState.status);
		if (wasTerminal !== isTerminal || wasActive !== isActive) {
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
	let beforeState = payload.beforeState;

	// rally_won events don't store beforeState to save space, but afterState of
	// the previous event is identical to beforeState of targetEvent.
	if (!beforeState && targetEvent.seqNo > 1) {
		const prevEvent = await getScoreEventBySeqNo(matchId, targetEvent.seqNo - 1, db);
		if (prevEvent) {
			beforeState = parsePayload(prevEvent.payloadJson).afterState;
		}
	}

	if (!beforeState) throw new Error('Undo target does not contain beforeState');
	return {
		...input,
		targetSeqNo: targetEvent.seqNo,
		restoreState: beforeState
	};
}

function parsePayload(payloadJson: string): {
	beforeState?: MatchState;
	afterState?: MatchState;
	input?: ScoreEventInput;
} {
	try {
		const raw = JSON.parse(payloadJson);
		if (typeof raw !== 'object' || raw === null) return {};

		const record = raw as Record<string, unknown>;
		const beforeState = record.beforeState
			? v.parse(MatchStateSchema, record.beforeState)
			: undefined;
		const afterState = record.afterState ? v.parse(MatchStateSchema, record.afterState) : undefined;
		const input = record.input ? v.parse(ScoreEventInputSchema, record.input) : undefined;

		return { beforeState, afterState, input };
	} catch {
		return {};
	}
}
