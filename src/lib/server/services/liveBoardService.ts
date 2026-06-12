import { asc, eq, inArray, isNotNull, and } from 'drizzle-orm';
import type { AppDb } from '$lib/server/db/client';
import {
	lineupItems,
	lineupSubmissions,
	matches,
	rubbers,
	scoreEvents,
	teamPlayers
} from '$lib/server/db/schema';

export type GameScore = { gameNo: number; scoreA: number; scoreB: number };

export type PublicRubberSummary = typeof rubbers.$inferSelect & {
	gamesScore: string | null;   // games won: "1-0"
	pointScore: string | null;   // current game points: "4-3"
	gameDetails: GameScore[];    // per-game: [{gameNo:1,scoreA:21,scoreB:15}, ...]
	sideAPlayers: string | null;
	sideBPlayers: string | null;
};

type PublicRubberInput = Pick<typeof rubbers.$inferSelect, 'id' | 'code' | 'matchId'>;
type PublicMatchInput = Pick<
	typeof matches.$inferSelect,
	'id' | 'gamesWonA' | 'gamesWonB' | 'currentScoreA' | 'currentScoreB' | 'currentGameNo' | 'status'
>;
type PublicGameScoreInput = { matchId: string; gameNo: number; scoreA: number; scoreB: number };
type PublicLineupSubmissionInput = Pick<typeof lineupSubmissions.$inferSelect, 'id' | 'side'>;
type PublicLineupItemInput = Pick<
	typeof lineupItems.$inferSelect,
	'submissionId' | 'rubberCode' | 'player1Id' | 'player2Id'
>;
type PublicTeamPlayerInput = Pick<typeof teamPlayers.$inferSelect, 'id' | 'name'>;

export async function getPublicRubbersForTie(
	db: AppDb,
	tieId: string,
	revealed: boolean
): Promise<PublicRubberSummary[]> {
	const rubberRows = await db
		.select()
		.from(rubbers)
		.where(eq(rubbers.tieId, tieId))
		.orderBy(asc(rubbers.displayOrder));
	const matchIds = rubberRows.map((r) => r.matchId).filter((id): id is string => !!id);

	const [matchRows, gameScoreRows] = await Promise.all([
		matchIds.length > 0
			? db
					.select({
						id: matches.id,
						gamesWonA: matches.gamesWonA,
						gamesWonB: matches.gamesWonB,
						currentScoreA: matches.currentScoreA,
						currentScoreB: matches.currentScoreB,
						currentGameNo: matches.currentGameNo,
						status: matches.status
					})
					.from(matches)
					.where(inArray(matches.id, matchIds))
			: Promise.resolve([]),
		fetchGameScores(db, matchIds)
	]);

	if (!revealed) {
		return createPublicRubberSummaries({
			rubbers: rubberRows,
			matches: matchRows,
			gameScores: gameScoreRows,
			revealed,
			submissions: [],
			items: [],
			players: []
		});
	}

	const submissions = await db
		.select()
		.from(lineupSubmissions)
		.where(eq(lineupSubmissions.tieId, tieId));
	const items =
		submissions.length > 0
			? await db
					.select()
					.from(lineupItems)
					.where(inArray(lineupItems.submissionId, submissions.map((s) => s.id)))
			: [];
	const playerIds = items
		.flatMap((item) => [item.player1Id, item.player2Id])
		.filter((id): id is string => !!id);
	const players =
		playerIds.length > 0
			? await db.select().from(teamPlayers).where(inArray(teamPlayers.id, playerIds))
			: [];

	return createPublicRubberSummaries({
		rubbers: rubberRows,
		matches: matchRows,
		gameScores: gameScoreRows,
		revealed,
		submissions,
		items,
		players
	});
}

async function fetchGameScores(
	db: AppDb,
	matchIds: string[]
): Promise<PublicGameScoreInput[]> {
	if (matchIds.length === 0) return [];

	// Fetch all scoring events ordered by seqNo; for each (matchId, gameNo) keep the last one
	const events = await db
		.select({
			matchId: scoreEvents.matchId,
			gameNo: scoreEvents.gameNo,
			seqNo: scoreEvents.seqNo,
			scoreA: scoreEvents.scoreAAfter,
			scoreB: scoreEvents.scoreBAfter
		})
		.from(scoreEvents)
		.where(
			and(
				inArray(scoreEvents.matchId, matchIds),
				isNotNull(scoreEvents.gameNo),
				isNotNull(scoreEvents.scoreAAfter)
			)
		)
		.orderBy(asc(scoreEvents.seqNo));

	const gameMap = new Map<string, PublicGameScoreInput>();
	for (const e of events) {
		if (e.gameNo === null || e.scoreA === null || e.scoreB === null) continue;
		const key = `${e.matchId}:${e.gameNo}`;
		gameMap.set(key, { matchId: e.matchId, gameNo: e.gameNo, scoreA: e.scoreA, scoreB: e.scoreB });
	}
	return Array.from(gameMap.values());
}

export function createPublicRubberSummaries<TRubber extends PublicRubberInput>(params: {
	rubbers: TRubber[];
	matches: PublicMatchInput[];
	gameScores?: PublicGameScoreInput[];
	revealed: boolean;
	submissions: PublicLineupSubmissionInput[];
	items: PublicLineupItemInput[];
	players: PublicTeamPlayerInput[];
}) {
	const sideA = params.submissions.find((s) => s.side === 'A');
	const sideB = params.submissions.find((s) => s.side === 'B');
	const gameScores = params.gameScores ?? [];

	return params.rubbers.map((rubber) => {
		const match = params.matches.find((m) => m.id === rubber.matchId) ?? null;
		const scores = scoreFor(match, gameScores);
		return {
			...rubber,
			gamesScore: scores.gamesScore,
			pointScore: scores.pointScore,
			gameDetails: scores.gameDetails,
			sideAPlayers: params.revealed
				? lineupNames(params.items, params.players, sideA?.id ?? null, rubber.code)
				: null,
			sideBPlayers: params.revealed
				? lineupNames(params.items, params.players, sideB?.id ?? null, rubber.code)
				: null
		};
	});
}

function scoreFor(
	match: PublicMatchInput | null,
	gameScores: PublicGameScoreInput[]
): { gamesScore: string | null; pointScore: string | null; gameDetails: GameScore[] } {
	if (!match) return { gamesScore: null, pointScore: null, gameDetails: [] };

	const matchGames = gameScores
		.filter((g) => g.matchId === match.id)
		.sort((a, b) => a.gameNo - b.gameNo);

	const gameDetails: GameScore[] = [];

	// Completed games (before current game number)
	for (const g of matchGames) {
		if (g.gameNo < match.currentGameNo) {
			gameDetails.push({ gameNo: g.gameNo, scoreA: g.scoreA, scoreB: g.scoreB });
		}
	}

	// Current / final game
	const isActive = match.status === 'playing' || match.status === 'interval';
	const isEnded =
		match.status === 'finished' ||
		match.status === 'confirmed' ||
		match.status === 'forfeited' ||
		match.status === 'retired';

	if (isActive) {
		// Use live score from matches table (most current)
		gameDetails.push({
			gameNo: match.currentGameNo,
			scoreA: match.currentScoreA,
			scoreB: match.currentScoreB
		});
	} else if (isEnded) {
		// Use last event's score for the final game, fall back to matches table
		const finalGameScore = matchGames.find((g) => g.gameNo === match.currentGameNo);
		gameDetails.push({
			gameNo: match.currentGameNo,
			scoreA: finalGameScore?.scoreA ?? match.currentScoreA,
			scoreB: finalGameScore?.scoreB ?? match.currentScoreB
		});
	}

	return {
		gamesScore: `${match.gamesWonA}-${match.gamesWonB}`,
		pointScore: `${match.currentScoreA}-${match.currentScoreB}`,
		gameDetails
	};
}

function lineupNames(
	items: PublicLineupItemInput[],
	players: PublicTeamPlayerInput[],
	submissionId: string | null,
	rubberCode: string
) {
	if (!submissionId) return null;
	const item = items.find(
		(row) => row.submissionId === submissionId && row.rubberCode === rubberCode
	);
	if (!item) return null;
	const first = players.find((p) => p.id === item.player1Id)?.name ?? '';
	const second = players.find((p) => p.id === item.player2Id)?.name ?? '';
	return [first, second].filter(Boolean).join(' / ') || null;
}
