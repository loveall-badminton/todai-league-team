import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { ScoreEventInput } from '$lib/domain/types';
import { createTestDb, type TestDb } from '$lib/server/testDb';
import { matchServiceStates, matchSnapshots, matches } from '$lib/server/db/schema';

const mockState = vi.hoisted(() => ({
	db: null as TestDb['db'] | null
}));

vi.mock('$lib/server/db/request', () => ({
	getRequestDb: () => {
		if (!mockState.db) throw new Error('test db is not initialized');
		return mockState.db;
	}
}));

import {
	createMatchWithPlayers,
	getMatchPlayers,
	getMatchState,
	getMatchWithPlayers,
	updateMatchDerivedState,
	upsertMatchServiceState,
	upsertMatchSnapshot
} from './matchRepository';
import {
	createCourt,
	createTournament,
	getTournament,
	listCourts,
	listMatchesForTournament,
	listTournaments
} from './tournamentRepository';
import {
	getLastUndoableScoreEvent,
	getScoreEventByIdempotencyKey,
	getScoreEventBySeqNo,
	getScoreEvents,
	hasUndoLink,
	insertScoreEvent,
	insertUndoLink
} from './scoreEventRepository';

let testDb: TestDb;
const now = '2026-06-15T01:00:00.000Z';

beforeEach(() => {
	testDb = createTestDb();
	mockState.db = testDb.db;
});

afterEach(() => {
	mockState.db = null;
	testDb.close();
});

async function seedTournamentMatch() {
	const tournamentId = await createTournament({
		name: 'Repository Cup',
		venue: 'Gym',
		startsAt: '2026-06-15T00:00:00.000Z',
		endsAt: null,
		now
	});
	const courtId = await createCourt({ tournamentId, name: 'Court 1', displayOrder: 1, now });
	const matchId = await createMatchWithPlayers({
		tournamentId,
		courtId,
		discipline: 'MS',
		eventName: 'Group A',
		category: 'Men',
		roundName: 'R1',
		players: [
			{ side: 'A', order: 1, name: 'A Player', teamName: 'Team A' },
			{ side: 'B', order: 1, name: 'B Player', teamName: 'Team B' }
		],
		now
	});
	return { tournamentId, courtId, matchId };
}

describe('tournamentRepository integration queries', () => {
	test('creates and reads tournaments, courts and live match summaries', async () => {
		const { tournamentId, courtId, matchId } = await seedTournamentMatch();
		await createCourt({ tournamentId, name: 'Court 0', displayOrder: 0, now });
		const players = await getMatchPlayers(matchId);

		const state = await getMatchState(matchId);
		state.status = 'playing';
		state.lastSeqNo = 1;
		state.updatedAt = '2026-06-15T01:05:00.000Z';
		state.games[0].score = { A: 7, B: 5 };
		state.service = {
			discipline: 'singles',
			servingSide: 'A',
			serviceCourt: 'left',
			serverPlayerId: players[0].id,
			receiverPlayerId: players[1].id
		};
		await updateMatchDerivedState(state);

		const tournament = await getTournament(tournamentId);
		const tournaments = await listTournaments();
		const courts = await listCourts(tournamentId);
		const liveMatches = await listMatchesForTournament(tournamentId);

		expect(tournament).toMatchObject({ id: tournamentId, name: 'Repository Cup', venue: 'Gym' });
		expect(tournaments.map((row) => row.id)).toEqual([tournamentId]);
		expect(courts.map((court) => [court.name, court.displayOrder])).toEqual([
			['Court 0', 0],
			['Court 1', 1]
		]);
		expect(liveMatches).toHaveLength(1);
		expect(liveMatches[0]).toMatchObject({
			id: matchId,
			courtId,
			courtName: 'Court 1',
			sideAName: 'A Player',
			sideBName: 'B Player',
			serverName: 'A Player',
			currentScoreA: 7,
			currentScoreB: 5,
			lastSeqNo: 1
		});
	});
});

describe('matchRepository integration queries', () => {
	test('creates a match with players and upserts derived snapshot/service state', async () => {
		const { matchId } = await seedTournamentMatch();
		const fullMatch = await getMatchWithPlayers(matchId);
		const players = await getMatchPlayers(matchId);
		const state = await getMatchState(matchId);

		state.status = 'playing';
		state.lastSeqNo = 3;
		state.updatedAt = '2026-06-15T01:10:00.000Z';
		state.games[0].score = { A: 11, B: 8 };
		state.service = {
			discipline: 'singles',
			servingSide: 'B',
			serviceCourt: 'right',
			serverPlayerId: players[1].id,
			receiverPlayerId: players[0].id
		};

		await updateMatchDerivedState(state);
		await upsertMatchSnapshot(state);
		await upsertMatchServiceState(state);

		const matchRow = await testDb.db.query.matches.findFirst({ where: eq(matches.id, matchId) });
		const snapshot = await testDb.db.query.matchSnapshots.findFirst({
			where: eq(matchSnapshots.matchId, matchId)
		});
		const serviceState = await testDb.db.query.matchServiceStates.findFirst({
			where: eq(matchServiceStates.matchId, matchId)
		});

		expect(fullMatch?.players.map((player) => [player.side, player.order, player.name])).toEqual([
			['A', 1, 'A Player'],
			['B', 1, 'B Player']
		]);
		expect(players.map((player) => player.name)).toEqual(['A Player', 'B Player']);
		expect(matchRow).toMatchObject({
			status: 'playing',
			currentScoreA: 11,
			currentScoreB: 8,
			currentServerPlayerId: players[1].id,
			lastSeqNo: 3
		});
		expect(snapshot).toMatchObject({ seqNo: 3 });
		expect(serviceState).toMatchObject({
			gameNo: 1,
			servingSide: 'B',
			serviceCourt: 'right',
			serverPlayerId: players[1].id
		});
	});
});

describe('scoreEventRepository integration queries', () => {
	test('inserts events, reads by ordering and idempotency, and records undo links', async () => {
		const { matchId } = await seedTournamentMatch();
		const beforeState = await getMatchState(matchId);
		const afterState = structuredClone(beforeState);
		afterState.lastSeqNo = 1;
		afterState.updatedAt = '2026-06-15T01:15:00.000Z';
		afterState.games[0].score = { A: 1, B: 0 };
		const rallyInput: ScoreEventInput = {
			type: 'rally_won',
			side: 'A',
			observedSeqNo: 0,
			idempotencyKey: 'idem-rally'
		};
		const undoInput: ScoreEventInput = {
			type: 'undo',
			targetSeqNo: 1,
			observedSeqNo: 1,
			idempotencyKey: 'idem-undo'
		};

		await insertScoreEvent({
			id: 'event-1',
			matchId,
			seqNo: 1,
			eventType: 'rally_won',
			side: 'A',
			beforeState,
			afterState,
			input: rallyInput,
			createdAt: now
		});
		await insertScoreEvent({
			id: 'event-2',
			matchId,
			seqNo: 2,
			eventType: 'undo_applied',
			targetSeqNo: 1,
			reason: '入力訂正',
			beforeState: afterState,
			afterState: beforeState,
			input: undoInput,
			createdAt: now
		});
		await insertUndoLink({
			matchId,
			undoEventId: 'event-2',
			targetEventId: 'event-1',
			targetSeqNo: 1,
			createdAt: now
		});

		const events = await getScoreEvents(matchId);
		const eventBySeq = await getScoreEventBySeqNo(matchId, 1);
		const eventByIdempotency = await getScoreEventByIdempotencyKey(matchId, 'idem-rally');
		const lastUndoable = await getLastUndoableScoreEvent(matchId);
		const undoLinked = await hasUndoLink(matchId, 1);

		expect(events.map((event) => [event.seqNo, event.eventType])).toEqual([
			[1, 'rally_won'],
			[2, 'undo_applied']
		]);
		expect(eventBySeq).toMatchObject({ id: 'event-1', scoreAAfter: 1, scoreBAfter: 0 });
		expect(eventByIdempotency).toMatchObject({ id: 'event-1' });
		expect(lastUndoable).toMatchObject({ id: 'event-1' });
		expect(undoLinked).toBe(true);
	});
});
