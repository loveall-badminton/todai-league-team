import { describe, expect, test } from 'vitest';
import { createInitialDoublesServiceState, createInitialMatchState } from '$lib/domain/scoring';
import type { MatchState, ScoreEventInput } from '$lib/domain/types';
import type { RequestDb } from './matchStateStore';
import {
	buildMatchServiceStateUpsert,
	buildMatchSnapshotUpsert,
	buildMatchUpdate,
	buildRubberUpdate,
	buildScoreEventInsert
} from './matchStateStore';

type DbCall =
	| { kind: 'insert'; table: object; values?: unknown; conflict?: unknown }
	| { kind: 'update'; table: object; set?: unknown; where?: unknown };

function createDbMock() {
	const calls: DbCall[] = [];

	const db = {
		insert(table: object) {
			const call: DbCall = { kind: 'insert', table };
			calls.push(call);
			return {
				values(values: unknown) {
					call.values = values;
					return {
						onConflictDoUpdate(options: unknown) {
							call.conflict = options;
							return { call };
						}
					};
				}
			};
		},
		update(table: object) {
			const call: DbCall = { kind: 'update', table };
			calls.push(call);
			return {
				set(values: unknown) {
					call.set = values;
					return {
						where(whereClause: unknown) {
							call.where = whereClause;
							return { call };
						}
					};
				}
			};
		}
	} as unknown as RequestDb;

	return { db, calls };
}

function createBaseState(partial: Partial<MatchState> = {}): MatchState {
	return {
		...createInitialMatchState({
			matchId: 'match-1',
			tournamentId: 'tournament-1',
			courtId: null,
			discipline: 'MD',
			now: '2026-06-20T00:00:00.000Z'
		}),
		...partial
	};
}

describe('matchStateStore', () => {
	test('buildMatchUpdate writes actual start and end timestamps for terminal transitions', () => {
		const { db, calls } = createDbMock();
		const state = createBaseState({
			status: 'finished',
			lastSeqNo: 1,
			updatedAt: '2026-06-20T00:10:00.000Z',
			service: createInitialDoublesServiceState({
				players: [
					{ id: 'a1', side: 'A', order: 1, name: 'A1' },
					{ id: 'a2', side: 'A', order: 2, name: 'A2' },
					{ id: 'b1', side: 'B', order: 1, name: 'B1' },
					{ id: 'b2', side: 'B', order: 2, name: 'B2' }
				],
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			})
		});

		buildMatchUpdate(db, state);

		expect(calls).toHaveLength(1);
		expect(calls[0]).toMatchObject({
			kind: 'update',
			set: {
				status: 'finished',
				currentGameNo: 1,
				gamesWonA: 0,
				gamesWonB: 0,
				actualStartAt: undefined,
				actualEndAt: '2026-06-20T00:10:00.000Z'
			}
		});
	});

	test('buildRubberUpdate returns null before match starts and updates active rubbers', () => {
		const { db, calls } = createDbMock();

		expect(buildRubberUpdate(db, 'rubber-1', createBaseState(), '2026-06-20T00:00:00.000Z')).toBe(
			null
		);

		const activeState = createBaseState({ status: 'playing', winnerSide: 'A' });
		buildRubberUpdate(db, 'rubber-1', activeState, '2026-06-20T00:05:00.000Z');

		expect(calls.at(-1)).toMatchObject({
			kind: 'update',
			set: {
				status: 'playing',
				winnerSide: 'A',
				updatedAt: '2026-06-20T00:05:00.000Z'
			}
		});
	});

	test('buildMatchSnapshotUpsert and buildMatchServiceStateUpsert set conflict targets', () => {
		const { db, calls } = createDbMock();
		const state = createBaseState({ status: 'playing' });

		buildMatchSnapshotUpsert(db, state);
		buildMatchServiceStateUpsert(db, state);

		expect(calls).toHaveLength(2);
		expect(calls[0]).toMatchObject({
			kind: 'insert',
			conflict: { target: expect.anything() }
		});
		expect(calls[1]).toMatchObject({
			kind: 'insert',
			conflict: { target: expect.anything() }
		});
	});

	test('buildScoreEventInsert derives event metadata from the input', () => {
		const { db, calls } = createDbMock();
		const beforeState = createBaseState();
		const afterState = createBaseState({
			lastSeqNo: 1,
			status: 'playing'
		});
		const input: ScoreEventInput = {
			type: 'undo',
			idempotencyKey: 'k1',
			observedSeqNo: 0,
			targetSeqNo: 9,
			reason: 'revert'
		};

		buildScoreEventInsert(db, {
			eventId: 'event-1',
			matchId: 'match-1',
			input,
			beforeState,
			afterState,
			now: '2026-06-20T00:00:00.000Z'
		});

		expect(calls[0]).toMatchObject({
			kind: 'insert',
			values: expect.objectContaining({
				eventType: 'undo_applied',
				targetSeqNo: 9,
				reason: 'revert',
				idempotencyKey: 'k1'
			})
		});
	});
});
