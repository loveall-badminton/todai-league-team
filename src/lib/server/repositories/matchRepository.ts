import { asc, eq } from 'drizzle-orm';
import { createInitialMatchState } from '$lib/domain/scoring';
import { MatchStateSchema } from '$lib/domain/schemas';
import type { MatchDiscipline, MatchPlayer, MatchState } from '$lib/domain/types';
import type { ScoringConfig } from '$lib/domain/types';
import * as v from 'valibot';
import { getRequestDb } from '$lib/server/db/request';
import { matchSidePlayers, matchSides, matchSnapshots, matches } from '$lib/server/db/schema';
import {
	buildMatchServiceStateUpsert,
	buildMatchSnapshotUpsert,
	buildMatchUpdate
} from './matchStateStore';

export interface CreateMatchWithPlayersInput {
	tournamentId: string;
	courtId: string | null;
	discipline: MatchDiscipline;
	eventName?: string | null;
	category?: string | null;
	roundName?: string | null;
	rubberId?: string | null;
	rankingTiebreakerId?: string | null;
	scoringRuleId?: string | null;
	scoring?: ScoringConfig;
	players: Array<{
		side: 'A' | 'B';
		order: 1 | 2;
		name: string;
		teamName?: string | null;
	}>;
	now: string;
}

export async function getMatchWithPlayers(matchId: string) {
	const db = getRequestDb();
	const match = await db.query.matches.findFirst({
		where: eq(matches.id, matchId),
		with: {
			court: true,
			sides: true
		}
	});
	if (!match) return null;

	return {
		match,
		players: await getMatchPlayers(matchId)
	};
}

export async function getMatchState(matchId: string): Promise<MatchState> {
	const db = getRequestDb();
	const snapshot = await db.query.matchSnapshots.findFirst({
		where: eq(matchSnapshots.matchId, matchId)
	});
	if (!snapshot) throw new Error('Match snapshot not found');
	return v.parse(MatchStateSchema, JSON.parse(snapshot.stateJson));
}

export async function getMatchPlayers(matchId: string): Promise<MatchPlayer[]> {
	const db = getRequestDb();
	const rows = await db
		.select()
		.from(matchSidePlayers)
		.where(eq(matchSidePlayers.matchId, matchId))
		.orderBy(asc(matchSidePlayers.side), asc(matchSidePlayers.playerOrder));

	return rows.map((row) => ({
		id: row.id,
		side: row.side,
		order: row.playerOrder as 1 | 2,
		name: row.name,
		teamName: row.teamName
	}));
}

export async function createMatchWithPlayers(input: CreateMatchWithPlayersInput): Promise<string> {
	const db = getRequestDb();
	const matchId = crypto.randomUUID();
	const sideAId = crypto.randomUUID();
	const sideBId = crypto.randomUUID();
	const sideAName = input.players
		.filter((player) => player.side === 'A')
		.map((player) => player.name)
		.join(' / ');
	const sideBName = input.players
		.filter((player) => player.side === 'B')
		.map((player) => player.name)
		.join(' / ');
	const state = createInitialMatchState({
		matchId,
		tournamentId: input.tournamentId,
		courtId: input.courtId,
		discipline: input.discipline,
		now: input.now,
		scoring: input.scoring
	});

	await db.batch([
		db.insert(matches).values({
			id: matchId,
			tournamentId: input.tournamentId,
			courtId: input.courtId,
			discipline: input.discipline,
			eventName: input.eventName,
			category: input.category,
			roundName: input.roundName,
			rubberId: input.rubberId ?? null,
			rankingTiebreakerId: input.rankingTiebreakerId ?? null,
			scoringRuleId: input.scoringRuleId ?? null,
			createdAt: input.now,
			updatedAt: input.now
		}),
		db.insert(matchSides).values([
			{
				id: sideAId,
				matchId,
				side: 'A',
				displayName: sideAName,
				createdAt: input.now,
				updatedAt: input.now
			},
			{
				id: sideBId,
				matchId,
				side: 'B',
				displayName: sideBName,
				createdAt: input.now,
				updatedAt: input.now
			}
		]),
		db.insert(matchSidePlayers).values(
			input.players.map((player) => ({
				id: crypto.randomUUID(),
				matchId,
				matchSideId: player.side === 'A' ? sideAId : sideBId,
				side: player.side,
				playerOrder: player.order,
				name: player.name,
				teamName: player.teamName,
				createdAt: input.now,
				updatedAt: input.now
			}))
		),
		buildMatchSnapshotUpsert(db, state),
		buildMatchServiceStateUpsert(db, state)
	] as const);

	return matchId;
}

export async function updateMatchDerivedState(state: MatchState): Promise<void> {
	const db = getRequestDb();
	await buildMatchUpdate(db, state);
}

export async function upsertMatchSnapshot(state: MatchState): Promise<void> {
	const db = getRequestDb();
	await buildMatchSnapshotUpsert(db, state);
}

export async function upsertMatchServiceState(state: MatchState): Promise<void> {
	const db = getRequestDb();
	await buildMatchServiceStateUpsert(db, state);
}
