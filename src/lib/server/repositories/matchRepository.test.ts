import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createInitialMatchState } from '$lib/domain/scoring';
import type { MatchState } from '$lib/domain/types';

const mockGetRequestDb = vi.hoisted(() => vi.fn());
const mockBuildMatchUpdate = vi.hoisted(() => vi.fn());
const mockBuildMatchSnapshotUpsert = vi.hoisted(() => vi.fn());
const mockBuildMatchServiceStateUpsert = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/db/request', () => ({
	getRequestDb: mockGetRequestDb
}));

vi.mock('./matchStateStore', () => ({
	buildMatchUpdate: mockBuildMatchUpdate,
	buildMatchSnapshotUpsert: mockBuildMatchSnapshotUpsert,
	buildMatchServiceStateUpsert: mockBuildMatchServiceStateUpsert
}));

import {
	buildCreateMatchWithPlayersStatementsForId,
	createMatchWithPlayers,
	getMatchPlayers,
	getMatchState,
	getMatchWithPlayers,
	updateMatchDerivedState,
	updateMatchResultVerification,
	upsertMatchServiceState,
	upsertMatchSnapshot
} from './matchRepository';

type MockDb = {
	query: {
		matches: { findFirst: ReturnType<typeof vi.fn> };
		matchSnapshots: { findFirst: ReturnType<typeof vi.fn> };
	};
	select: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
	insert: ReturnType<typeof vi.fn>;
	batch: ReturnType<typeof vi.fn>;
};

function createMockDb(): MockDb {
	const insertChain = {
		values: vi.fn(() => insertChain)
	};
	const updateChain = {
		set: vi.fn(() => ({ where: vi.fn(() => undefined) }))
	};
	const selectChain = {
		from: vi.fn(() => ({
			where: vi.fn(() => ({
				orderBy: vi.fn(async () => [
					{
						id: 'player-a',
						side: 'A',
						playerOrder: 1,
						name: 'Alice',
						teamName: 'Team A'
					},
					{
						id: 'player-b',
						side: 'B',
						playerOrder: 2,
						name: 'Bob',
						teamName: 'Team B'
					}
				])
			}))
		}))
	};

	return {
		query: {
			matches: { findFirst: vi.fn() },
			matchSnapshots: { findFirst: vi.fn() }
		},
		select: vi.fn(() => selectChain),
		update: vi.fn(() => updateChain),
		insert: vi.fn(() => insertChain),
		batch: vi.fn(async () => undefined)
	};
}

function createMatchState(): MatchState {
	return createInitialMatchState({
		matchId: 'match-1',
		tournamentId: 'tournament-1',
		courtId: 'court-1',
		discipline: 'MS',
		now: '2026-06-20T00:00:00.000Z'
	});
}

describe('matchRepository', () => {
	let db: MockDb;

	beforeEach(() => {
		db = createMockDb();
		mockGetRequestDb.mockResolvedValue(db);
		vi.clearAllMocks();
	});

	test('buildCreateMatchWithPlayersStatementsForId creates match, sides, players, and state upserts', () => {
		const { statements, matchId } = buildCreateMatchWithPlayersStatementsForId(
			db as never,
			{
				tournamentId: 'tournament-1',
				courtId: 'court-1',
				discipline: 'MS',
				eventName: 'Event',
				category: 'Men',
				roundName: 'R1',
				rubberId: 'rubber-1',
				rankingTiebreakerId: null,
				scoringRuleId: 'GROUP_15',
				players: [
					{ side: 'A', order: 1, name: 'Alice', teamName: 'Team A' },
					{ side: 'B', order: 1, name: 'Bob', teamName: 'Team B' }
				],
				now: '2026-06-20T00:00:00.000Z'
			},
			'match-1'
		);

		expect(matchId).toBe('match-1');
		expect(statements).toHaveLength(5);
		expect(db.insert).toHaveBeenCalledTimes(3);
		expect(mockBuildMatchSnapshotUpsert).toHaveBeenCalled();
		expect(mockBuildMatchServiceStateUpsert).toHaveBeenCalled();
	});

	test('createMatchWithPlayers batches the generated statements', async () => {
		db.batch = vi.fn(async () => undefined);

		await createMatchWithPlayers({
			tournamentId: 'tournament-1',
			courtId: 'court-1',
			discipline: 'MS',
			players: [
				{ side: 'A', order: 1, name: 'Alice' },
				{ side: 'B', order: 1, name: 'Bob' }
			],
			now: '2026-06-20T00:00:00.000Z'
		});

		expect(db.batch).toHaveBeenCalledTimes(1);
	});

	test('getMatchPlayers maps rows to domain shape and getMatchState parses snapshots', async () => {
		db.query.matchSnapshots.findFirst.mockResolvedValue({
			stateJson: JSON.stringify(createMatchState())
		});

		const players = await getMatchPlayers('match-1', db as never);
		const state = await getMatchState('match-1', db as never);

		expect(players).toEqual([
			{
				id: 'player-a',
				side: 'A',
				order: 1,
				name: 'Alice',
				teamName: 'Team A'
			},
			{
				id: 'player-b',
				side: 'B',
				order: 2,
				name: 'Bob',
				teamName: 'Team B'
			}
		]);
		expect(state.matchId).toBe('match-1');
	});

	test('getMatchWithPlayers returns null when no match exists and loads players otherwise', async () => {
		db.query.matches.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'match-1' });
		db.query.matchSnapshots.findFirst.mockResolvedValue({
			stateJson: JSON.stringify(createMatchState())
		});

		await expect(getMatchWithPlayers('missing')).resolves.toBeNull();
		await expect(getMatchWithPlayers('match-1')).resolves.toMatchObject({
			match: { id: 'match-1' },
			players: [
				{
					id: 'player-a',
					side: 'A',
					order: 1,
					name: 'Alice',
					teamName: 'Team A'
				},
				{
					id: 'player-b',
					side: 'B',
					order: 2,
					name: 'Bob',
					teamName: 'Team B'
				}
			]
		});
	});

	test('update and upsert helpers delegate to matchStateStore builders', async () => {
		const state = createMatchState();
		await updateMatchResultVerification('match-1', {
			refereeName: 'Ref',
			winnerConfirmedAt: null,
			winnerConfirmedBySide: 'A',
			updatedAt: state.updatedAt
		});
		await updateMatchDerivedState(state);
		await upsertMatchSnapshot(state);
		await upsertMatchServiceState(state);

		expect(db.update).toHaveBeenCalled();
		expect(mockBuildMatchUpdate).toHaveBeenCalledWith(db, state);
		expect(mockBuildMatchSnapshotUpsert).toHaveBeenCalledWith(db, state);
		expect(mockBuildMatchServiceStateUpsert).toHaveBeenCalledWith(db, state);
	});
});
