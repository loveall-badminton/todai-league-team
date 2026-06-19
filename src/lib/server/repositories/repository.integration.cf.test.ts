/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { ScoreEventInput } from '$lib/domain/types';
import { createCfTestDb, type CfTestDb } from '$lib/server/cfTestDb';
import {
	matchServiceStates,
	matchSnapshots,
	matches,
	teams as leagueTeams,
	ties as leagueTies
} from '$lib/server/db/schema';

const mockState = vi.hoisted(() => ({
	db: null as CfTestDb['db'] | null
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
import {
	assignOfficiatingTeams,
	getOfficiatingAssignment,
	listOfficiatingTieIds,
	listTies
} from './tokyoLeagueRepository';

let cfTestDb: CfTestDb;
const now = '2026-06-15T01:00:00.000Z';

beforeAll(() => {
	cfTestDb = createCfTestDb(env.DB);
});

beforeEach(async () => {
	mockState.db = cfTestDb.db;
	await cfTestDb.reset();
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

		const matchRow = await cfTestDb.db.query.matches.findFirst({ where: eq(matches.id, matchId) });
		const snapshot = await cfTestDb.db.query.matchSnapshots.findFirst({
			where: eq(matchSnapshots.matchId, matchId)
		});
		const serviceState = await cfTestDb.db.query.matchServiceStates.findFirst({
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
		expect(lastUndoable).toBeNull();
		expect(undoLinked).toBe(true);
	});

	test('getLastUndoableScoreEvent skips already-undone events and returns next', async () => {
		const { matchId } = await seedTournamentMatch();
		const state = await getMatchState(matchId);

		await insertScoreEvent({
			id: 'ev-1',
			matchId,
			seqNo: 1,
			eventType: 'rally_won',
			side: 'A',
			beforeState: state,
			afterState: state,
			input: { type: 'rally_won', side: 'A' as const, observedSeqNo: 0, idempotencyKey: 'k1' },
			createdAt: now
		});
		await insertScoreEvent({
			id: 'ev-2',
			matchId,
			seqNo: 2,
			eventType: 'rally_won',
			side: 'B',
			beforeState: state,
			afterState: state,
			input: { type: 'rally_won', side: 'B' as const, observedSeqNo: 1, idempotencyKey: 'k2' },
			createdAt: now
		});
		await insertScoreEvent({
			id: 'uev',
			matchId,
			seqNo: 3,
			eventType: 'undo_applied',
			targetSeqNo: 2,
			side: null,
			beforeState: state,
			afterState: state,
			input: {
				type: 'undo',
				targetSeqNo: 2,
				observedSeqNo: 2,
				idempotencyKey: 'ku'
			} as ScoreEventInput,
			createdAt: now
		});
		await insertUndoLink({
			matchId,
			undoEventId: 'uev',
			targetEventId: 'ev-2',
			targetSeqNo: 2,
			createdAt: now
		});

		expect((await getLastUndoableScoreEvent(matchId))?.seqNo).toBe(1);
	});

	test('getLastUndoableScoreEvent returns null when all undoable events are undone', async () => {
		const { matchId } = await seedTournamentMatch();
		const state = await getMatchState(matchId);

		await insertScoreEvent({
			id: 'ev-1',
			matchId,
			seqNo: 1,
			eventType: 'rally_won',
			side: 'A',
			beforeState: state,
			afterState: state,
			input: { type: 'rally_won', side: 'A' as const, observedSeqNo: 0, idempotencyKey: 'k1' },
			createdAt: now
		});
		await insertScoreEvent({
			id: 'uev',
			matchId,
			seqNo: 2,
			eventType: 'undo_applied',
			targetSeqNo: 1,
			side: null,
			beforeState: state,
			afterState: state,
			input: {
				type: 'undo',
				targetSeqNo: 1,
				observedSeqNo: 1,
				idempotencyKey: 'ku'
			} as ScoreEventInput,
			createdAt: now
		});
		await insertUndoLink({
			matchId,
			undoEventId: 'uev',
			targetEventId: 'ev-1',
			targetSeqNo: 1,
			createdAt: now
		});

		expect(await getLastUndoableScoreEvent(matchId)).toBeNull();
	});

	test('getLastUndoableScoreEvent handles progressive sequential undos correctly', async () => {
		const { matchId } = await seedTournamentMatch();
		const state = await getMatchState(matchId);
		let nextSeqNo = 0;

		await insertScoreEvent({
			id: 'ev-1',
			matchId,
			seqNo: ++nextSeqNo,
			eventType: 'rally_won',
			side: 'A',
			beforeState: state,
			afterState: state,
			input: { type: 'rally_won', side: 'A' as const, observedSeqNo: 0, idempotencyKey: 'k1' },
			createdAt: now
		});
		await insertScoreEvent({
			id: 'ev-2',
			matchId,
			seqNo: ++nextSeqNo,
			eventType: 'rally_won',
			side: 'B',
			beforeState: state,
			afterState: state,
			input: { type: 'rally_won', side: 'B' as const, observedSeqNo: 1, idempotencyKey: 'k2' },
			createdAt: now
		});
		await insertScoreEvent({
			id: 'ev-3',
			matchId,
			seqNo: ++nextSeqNo,
			eventType: 'rally_won',
			side: 'A',
			beforeState: state,
			afterState: state,
			input: { type: 'rally_won', side: 'A' as const, observedSeqNo: 2, idempotencyKey: 'k3' },
			createdAt: now
		});

		expect((await getLastUndoableScoreEvent(matchId))?.seqNo).toBe(3);

		await insertScoreEvent({
			id: 'uev-1',
			matchId,
			seqNo: ++nextSeqNo,
			eventType: 'undo_applied',
			targetSeqNo: 3,
			side: null,
			beforeState: state,
			afterState: state,
			input: {
				type: 'undo',
				targetSeqNo: 3,
				observedSeqNo: 3,
				idempotencyKey: 'ku1'
			} as ScoreEventInput,
			createdAt: now
		});
		await insertUndoLink({
			matchId,
			undoEventId: 'uev-1',
			targetEventId: 'ev-3',
			targetSeqNo: 3,
			createdAt: now
		});
		expect((await getLastUndoableScoreEvent(matchId))?.seqNo).toBe(2);

		await insertScoreEvent({
			id: 'uev-2',
			matchId,
			seqNo: ++nextSeqNo,
			eventType: 'undo_applied',
			targetSeqNo: 2,
			side: null,
			beforeState: state,
			afterState: state,
			input: {
				type: 'undo',
				targetSeqNo: 2,
				observedSeqNo: 4,
				idempotencyKey: 'ku2'
			} as ScoreEventInput,
			createdAt: now
		});
		await insertUndoLink({
			matchId,
			undoEventId: 'uev-2',
			targetEventId: 'ev-2',
			targetSeqNo: 2,
			createdAt: now
		});
		expect((await getLastUndoableScoreEvent(matchId))?.seqNo).toBe(1);

		await insertScoreEvent({
			id: 'uev-3',
			matchId,
			seqNo: ++nextSeqNo,
			eventType: 'undo_applied',
			targetSeqNo: 1,
			side: null,
			beforeState: state,
			afterState: state,
			input: {
				type: 'undo',
				targetSeqNo: 1,
				observedSeqNo: 5,
				idempotencyKey: 'ku3'
			} as ScoreEventInput,
			createdAt: now
		});
		await insertUndoLink({
			matchId,
			undoEventId: 'uev-3',
			targetEventId: 'ev-1',
			targetSeqNo: 1,
			createdAt: now
		});
		expect(await getLastUndoableScoreEvent(matchId)).toBeNull();
		void nextSeqNo;
	});
});

describe('tokyoLeagueRepository officiating assignments', () => {
	test('assigns multiple umpire teams and replaces the assignment set', async () => {
		await cfTestDb.db.insert(leagueTeams).values([
			{ id: 'team-a', name: 'Alpha', groupCode: 'A', createdAt: now, updatedAt: now },
			{ id: 'team-b', name: 'Beta', groupCode: 'A', createdAt: now, updatedAt: now },
			{ id: 'team-c', name: 'Gamma', groupCode: 'A', createdAt: now, updatedAt: now }
		]);
		await cfTestDb.db.insert(leagueTies).values({
			id: 'tie-1',
			tieCode: 'A-1',
			phase: 'group_a',
			groupCode: 'A',
			teamAId: 'team-a',
			teamBId: 'team-b',
			createdAt: now,
			updatedAt: now
		});

		await assignOfficiatingTeams({
			tieId: 'tie-1',
			assignedTeamIds: ['team-b', 'team-c'],
			note: '2チーム体制',
			now
		});

		const assignment = await getOfficiatingAssignment('tie-1');
		const tie = (await listTies('group_a'))[0];
		expect(assignment).toMatchObject({
			assignedTeamId: 'team-b',
			assignedTeamIds: ['team-b', 'team-c'],
			note: '2チーム体制'
		});
		expect(tie).toMatchObject({
			officiatingTeamId: 'team-b',
			officiatingTeamIds: ['team-b', 'team-c'],
			officiatingTeamNames: ['Beta', 'Gamma']
		});
		expect(await listOfficiatingTieIds('team-c')).toEqual(['tie-1']);

		await assignOfficiatingTeams({
			tieId: 'tie-1',
			assignedTeamIds: ['team-c'],
			note: null,
			now: '2026-06-15T02:00:00.000Z'
		});

		expect(await getOfficiatingAssignment('tie-1')).toMatchObject({
			assignedTeamId: 'team-c',
			assignedTeamIds: ['team-c'],
			note: null
		});
		expect(await listOfficiatingTieIds('team-b')).toEqual([]);
	});
});
