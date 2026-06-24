import { asc, eq, inArray } from 'drizzle-orm';
import { getRequestDb } from '$lib/server/db/request';
import { courts, matchSidePlayers, matchSides, matches, tournaments } from '$lib/server/db/schema';

export type Tournament = typeof tournaments.$inferSelect;
export type Court = typeof courts.$inferSelect;

export interface LiveMatchSummary {
	id: string;
	tournamentId: string;
	courtId: string | null;
	courtName: string | null;
	discipline: string;
	eventName: string | null;
	category: string | null;
	roundName: string | null;
	status: string;
	currentGameNo: number;
	currentScoreA: number;
	currentScoreB: number;
	gamesWonA: number;
	gamesWonB: number;
	winnerSide: 'A' | 'B' | null;
	currentServingSide: 'A' | 'B' | null;
	currentServiceCourt: 'right' | 'left' | null;
	currentServerPlayerId: string | null;
	currentReceiverPlayerId: string | null;
	lastSeqNo: number;
	sideAName: string;
	sideBName: string;
	serverName: string | null;
}

export async function createTournament(input: {
	name: string;
	venue?: string | null;
	startsAt?: string | null;
	endsAt?: string | null;
	now: string;
}): Promise<string> {
	const db = getRequestDb();
	const id = crypto.randomUUID();
	await db.insert(tournaments).values({
		id,
		name: input.name,
		venue: input.venue,
		startsAt: input.startsAt,
		endsAt: input.endsAt,
		createdAt: input.now,
		updatedAt: input.now
	});
	return id;
}

export async function listTournaments(): Promise<Tournament[]> {
	const db = getRequestDb();
	return db.select().from(tournaments).orderBy(asc(tournaments.startsAt), asc(tournaments.name));
}

export async function getTournament(tournamentId: string): Promise<Tournament | null> {
	const db = getRequestDb();
	const tournament = await db.query.tournaments.findFirst({
		where: eq(tournaments.id, tournamentId)
	});
	return tournament ?? null;
}

export async function createCourt(input: {
	tournamentId: string;
	name: string;
	displayOrder: number;
	now: string;
}): Promise<string> {
	const db = getRequestDb();
	const id = crypto.randomUUID();
	await db.insert(courts).values({
		id,
		tournamentId: input.tournamentId,
		name: input.name,
		displayOrder: input.displayOrder,
		createdAt: input.now,
		updatedAt: input.now
	});
	return id;
}

export async function listCourts(tournamentId: string): Promise<Court[]> {
	const db = getRequestDb();
	const courtRows = db
		.select()
		.from(courts)
		.where(eq(courts.tournamentId, tournamentId))
		.orderBy(asc(courts.displayOrder), asc(courts.name));

	return courtRows;
}

export async function listMatchesForTournament(tournamentId: string): Promise<LiveMatchSummary[]> {
	const db = getRequestDb();
	const matchRows = await db
		.select()
		.from(matches)
		.where(eq(matches.tournamentId, tournamentId))
		.orderBy(asc(matches.displayOrder), asc(matches.createdAt));
	const courtRows = await listCourts(tournamentId);

	if (!matchRows.length) return [];

	const matchIds = matchRows.map((m) => m.id);

	const allSides = await db.select().from(matchSides).where(inArray(matchSides.matchId, matchIds));

	const allPlayers = await db
		.select()
		.from(matchSidePlayers)
		.where(inArray(matchSidePlayers.matchId, matchIds))
		.orderBy(asc(matchSidePlayers.playerOrder));

	const sidesByMatchId = new Map<string, typeof allSides>();
	for (const s of allSides) {
		const list = sidesByMatchId.get(s.matchId) ?? [];
		list.push(s);
		sidesByMatchId.set(s.matchId, list);
	}

	const playersByMatchId = new Map<string, typeof allPlayers>();
	for (const p of allPlayers) {
		const list = playersByMatchId.get(p.matchId) ?? [];
		list.push(p);
		playersByMatchId.set(p.matchId, list);
	}

	return matchRows.map((match) => {
		const matchSidesRows = sidesByMatchId.get(match.id) ?? [];
		const matchPlayers = playersByMatchId.get(match.id) ?? [];
		const sideA = matchSidesRows.find((side) => side.side === 'A');
		const sideB = matchSidesRows.find((side) => side.side === 'B');
		const server = matchPlayers.find((player) => player.id === match.currentServerPlayerId);
		const court = courtRows.find((item) => item.id === match.courtId);

		return {
			id: match.id,
			tournamentId: match.tournamentId,
			courtId: match.courtId,
			courtName: court?.name ?? null,
			discipline: match.discipline,
			eventName: match.eventName,
			category: match.category,
			roundName: match.roundName,
			status: match.status,
			currentGameNo: match.currentGameNo,
			currentScoreA: match.currentScoreA,
			currentScoreB: match.currentScoreB,
			gamesWonA: match.gamesWonA,
			gamesWonB: match.gamesWonB,
			winnerSide: match.winnerSide,
			currentServingSide: match.currentServingSide,
			currentServiceCourt: match.currentServiceCourt,
			currentServerPlayerId: match.currentServerPlayerId,
			currentReceiverPlayerId: match.currentReceiverPlayerId,
			lastSeqNo: match.lastSeqNo,
			sideAName: sideA?.displayName ?? 'A',
			sideBName: sideB?.displayName ?? 'B',
			serverName: server?.name ?? null
		};
	});
}
