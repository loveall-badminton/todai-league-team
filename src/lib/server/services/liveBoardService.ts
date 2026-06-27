import { asc, eq, inArray, isNotNull, and } from 'drizzle-orm';
import { getRequestDb } from '$lib/server/db/request';
import { batchQuery } from '$lib/server/db/utils';
import {
	lineupItems,
	lineupSubmissions,
	matches,
	rubbers,
	scoreEvents,
	teamPlayers,
	teams,
	ties
} from '$lib/server/db/schema';

export type LiveGameScore = {
	gameNo: number;
	scoreA: number;
	scoreB: number;
	winnerSide?: 'A' | 'B' | null;
};

export type PublicRubberSummary = typeof rubbers.$inferSelect & {
	winnerSide: 'A' | 'B' | null;
	matchStatus: typeof matches.$inferSelect.status | null;
	gamesScore: string | null; // games won: "1-0"
	pointScore: string | null; // current game points: "4-3"
	gameDetails: LiveGameScore[]; // per-game: [{gameNo:1,scoreA:21,scoreB:15}, ...]
	sideAPlayers: string | null;
	sideBPlayers: string | null;
};

type PublicRubberInput = Pick<
	typeof rubbers.$inferSelect,
	'id' | 'code' | 'matchId' | 'status' | 'winnerSide'
>;
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
	tieId: string,
	revealed: boolean
): Promise<PublicRubberSummary[]> {
	const db = getRequestDb();
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
		fetchLiveGameScores(matchIds)
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
					.where(
						inArray(
							lineupItems.submissionId,
							submissions.map((s) => s.id)
						)
					)
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

async function fetchLiveGameScores(matchIds: string[]): Promise<PublicGameScoreInput[]> {
	if (matchIds.length === 0) return [];
	const db = getRequestDb();

	// Fetch all scoring events ordered by seqNo; for each (matchId, gameNo) keep the last one.
	// Also fetch scoreABefore/scoreBBefore and side so we can recover the correct final score
	// from legacy records where the game-winning rally was stored with scoreAAfter=0 due to a bug
	// (afterState.currentGameNo had already advanced to the next game).
	const events = await batchQuery(matchIds, async (batch) =>
		db
			.select({
				matchId: scoreEvents.matchId,
				gameNo: scoreEvents.gameNo,
				seqNo: scoreEvents.seqNo,
				scoreA: scoreEvents.scoreAAfter,
				scoreB: scoreEvents.scoreBAfter,
				scoreABefore: scoreEvents.scoreABefore,
				scoreBBefore: scoreEvents.scoreBBefore,
				side: scoreEvents.side
			})
			.from(scoreEvents)
			.where(
				and(
					inArray(scoreEvents.matchId, batch),
					isNotNull(scoreEvents.gameNo),
					isNotNull(scoreEvents.scoreAAfter)
				)
			)
			.orderBy(asc(scoreEvents.seqNo))
	);

	const gameMap = new Map<string, PublicGameScoreInput>();
	for (const e of events) {
		if (e.gameNo === null || e.scoreA === null || e.scoreB === null) continue;
		let scoreA = e.scoreA;
		let scoreB = e.scoreB;
		// Detect legacy game-winning rally bug: scoreAAfter=0 but the before-scores are non-zero.
		// Reconstruct correct final score from before-score + the scoring side.
		if (scoreA === 0 && scoreB === 0 && ((e.scoreABefore ?? 0) > 0 || (e.scoreBBefore ?? 0) > 0)) {
			scoreA = (e.scoreABefore ?? 0) + (e.side === 'A' ? 1 : 0);
			scoreB = (e.scoreBBefore ?? 0) + (e.side === 'B' ? 1 : 0);
		}
		const key = `${e.matchId}:${e.gameNo}`;
		gameMap.set(key, { matchId: e.matchId, gameNo: e.gameNo, scoreA, scoreB });
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
	const matchById = new Map(params.matches.map((match) => [match.id, match]));
	const gameScoresByMatchId = groupBy(gameScores, (score) => score.matchId);
	const playerNameById = new Map(params.players.map((player) => [player.id, player.name]));
	const lineupItemBySubmissionAndRubber = new Map(
		params.items.map((item) => [`${item.submissionId}:${item.rubberCode}`, item])
	);

	return params.rubbers.map((rubber) => {
		const match = rubber.matchId ? (matchById.get(rubber.matchId) ?? null) : null;
		const scores = scoreFor(match, match ? (gameScoresByMatchId.get(match.id) ?? []) : []);
		return {
			...rubber,
			winnerSide: rubber.winnerSide ?? null,
			matchStatus: match?.status ?? null,
			status: rubberStatusForMatch(rubber.status, match),
			gamesScore: scores.gamesScore,
			pointScore: scores.pointScore,
			gameDetails: scores.gameDetails,
			sideAPlayers: params.revealed
				? lineupNames(
						lineupItemBySubmissionAndRubber,
						playerNameById,
						sideA?.id ?? null,
						rubber.code
					)
				: null,
			sideBPlayers: params.revealed
				? lineupNames(
						lineupItemBySubmissionAndRubber,
						playerNameById,
						sideB?.id ?? null,
						rubber.code
					)
				: null
		};
	});
}

function rubberStatusForMatch(
	currentStatus: PublicRubberInput['status'],
	match: PublicMatchInput | null
): PublicRubberInput['status'] {
	if (!match) return currentStatus;
	if (match.status === 'confirmed') return 'confirmed';
	if (['finished', 'forfeited', 'retired'].includes(match.status)) return 'finished';
	if (['playing', 'interval', 'suspended'].includes(match.status)) return 'playing';
	if (['scheduled', 'called', 'warmup'].includes(match.status)) return 'scheduled';
	if (match.status === 'cancelled') return 'cancelled';
	return currentStatus;
}

function winnerSide(scoreA: number, scoreB: number): 'A' | 'B' | null {
	if (scoreA > scoreB) return 'A';
	if (scoreB > scoreA) return 'B';
	return null;
}

function scoreFor(
	match: PublicMatchInput | null,
	gameScores: PublicGameScoreInput[]
): { gamesScore: string | null; pointScore: string | null; gameDetails: LiveGameScore[] } {
	if (!match) return { gamesScore: null, pointScore: null, gameDetails: [] };

	const matchGames = [...gameScores].sort((a, b) => a.gameNo - b.gameNo);

	const gameDetails: LiveGameScore[] = [];

	// Completed games (before current game number)
	for (const g of matchGames) {
		if (g.gameNo < match.currentGameNo) {
			gameDetails.push({
				gameNo: g.gameNo,
				scoreA: g.scoreA,
				scoreB: g.scoreB,
				winnerSide: winnerSide(g.scoreA, g.scoreB)
			});
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
		const finalLiveGameScore = matchGames.find((g) => g.gameNo === match.currentGameNo);
		const finalScoreA = finalLiveGameScore?.scoreA ?? match.currentScoreA;
		const finalScoreB = finalLiveGameScore?.scoreB ?? match.currentScoreB;
		gameDetails.push({
			gameNo: match.currentGameNo,
			scoreA: finalScoreA,
			scoreB: finalScoreB,
			winnerSide: winnerSide(finalScoreA, finalScoreB)
		});
	}

	return {
		gamesScore: `${match.gamesWonA}-${match.gamesWonB}`,
		pointScore: `${match.currentScoreA}-${match.currentScoreB}`,
		gameDetails
	};
}

function lineupNames(
	itemsBySubmissionAndRubber: Map<string, PublicLineupItemInput>,
	playerNameById: Map<string, string>,
	submissionId: string | null,
	rubberCode: string
) {
	if (!submissionId) return null;
	const item = itemsBySubmissionAndRubber.get(`${submissionId}:${rubberCode}`);
	if (!item) return null;
	const first = playerNameById.get(item.player1Id) ?? '';
	const second = playerNameById.get(item.player2Id) ?? '';
	return [first, second].filter(Boolean).join(' / ') || null;
}

function groupBy<T, K>(items: T[], keyFor: (item: T) => K) {
	const map = new Map<K, T[]>();
	for (const item of items) {
		const key = keyFor(item);
		const group = map.get(key);
		if (group) group.push(item);
		else map.set(key, [item]);
	}
	return map;
}

export async function getPublicRubbers(tieId: string): Promise<PublicRubberSummary[]> {
	const db = getRequestDb();
	const tie = await db.query.ties.findFirst({ where: eq(ties.id, tieId) });
	if (!tie) return [];
	const revealed = ['playing', 'finished', 'confirmed'].includes(tie.status);
	return getPublicRubbersForTie(tieId, revealed);
}

export async function getBatchedPublicRubbers(
	tieIds: string[],
	options: { revealed?: boolean } = {}
): Promise<PublicRubberSummary[][]> {
	if (!tieIds.length) return [];

	const db = getRequestDb();
	const revealed = options.revealed ?? true;

	// 1. Fetch all rubbers for all ties
	const allRubbers = await db
		.select()
		.from(rubbers)
		.where(inArray(rubbers.tieId, tieIds))
		.orderBy(asc(rubbers.displayOrder));

	const matchIds = allRubbers.map((r) => r.matchId).filter((id): id is string => !!id);

	// 2. Fetch all matches
	const allMatches =
		matchIds.length > 0
			? await batchQuery(matchIds, async (batch) =>
					db
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
						.where(inArray(matches.id, batch))
				)
			: [];

	// 3. Fetch all game scores
	const allGameScores = matchIds.length > 0 ? await fetchLiveGameScores(matchIds) : [];

	// 4. Fetch all lineup submissions
	const allSubmissions = revealed
		? await db.select().from(lineupSubmissions).where(inArray(lineupSubmissions.tieId, tieIds))
		: [];

	const submissionIds = allSubmissions.map((s) => s.id);

	// 5. Fetch all lineup items
	const allItems =
		revealed && submissionIds.length > 0
			? await db.select().from(lineupItems).where(inArray(lineupItems.submissionId, submissionIds))
			: [];

	const playerIds = allItems
		.flatMap((item) => [item.player1Id, item.player2Id])
		.filter((id): id is string => !!id);

	// 6. Fetch all players
	const allPlayers =
		revealed && playerIds.length > 0
			? await batchQuery(playerIds, async (batch) =>
					db.select().from(teamPlayers).where(inArray(teamPlayers.id, batch))
				)
			: [];

	// Group per tie
	const rubbersByTieId = groupBy(allRubbers, (rubber) => rubber.tieId);
	const submissionsByTieId = groupBy(allSubmissions, (submission) => submission.tieId);
	return tieIds.map((tieId) => {
		return createPublicRubberSummaries({
			rubbers: rubbersByTieId.get(tieId) ?? [],
			matches: allMatches,
			gameScores: allGameScores,
			revealed,
			submissions: submissionsByTieId.get(tieId) ?? [],
			items: allItems,
			players: allPlayers
		});
	});
}

export async function getActiveTieBoard() {
	const db = getRequestDb();
	const tieRows = await db
		.select()
		.from(ties)
		.where(eq(ties.status, 'playing'))
		.orderBy(asc(ties.displayOrder), asc(ties.tieCode));

	if (!tieRows.length)
		return {
			ties: [] as ((typeof tieRows)[number] & {
				teamAName: string | null;
				teamBName: string | null;
			})[],
			rubbersByTieId: {} as Record<string, PublicRubberSummary[]>
		};

	const tieIds = tieRows.map((t) => t.id);
	const teamIds = [
		...new Set(tieRows.flatMap((t) => [t.teamAId, t.teamBId]).filter((id): id is string => !!id))
	];
	const teamRows = await db.select().from(teams).where(inArray(teams.id, teamIds));
	const teamNameById = new Map(teamRows.map((team) => [team.id, team.name]));

	const rubberResults = await getBatchedPublicRubbers(tieIds);

	return {
		ties: tieRows.map((tie) => ({
			...tie,
			teamAName: tie.teamAId ? (teamNameById.get(tie.teamAId) ?? null) : null,
			teamBName: tie.teamBId ? (teamNameById.get(tie.teamBId) ?? null) : null
		})),
		rubbersByTieId: Object.fromEntries(tieRows.map((tie, i) => [tie.id, rubberResults[i]]))
	};
}

export async function getFinalsTieBoard() {
	const db = getRequestDb();
	const finalPhases = ['semifinal', 'final', 'third_place', 'fifth_place'] as const;
	const tieRows = await db
		.select()
		.from(ties)
		.where(inArray(ties.phase, finalPhases))
		.orderBy(asc(ties.displayOrder), asc(ties.tieCode));

	if (!tieRows.length) return { finalsBoard: [] };

	const teamIds = [
		...new Set(tieRows.flatMap((t) => [t.teamAId, t.teamBId]).filter((id): id is string => !!id))
	];
	const teamRows = teamIds.length
		? await db.select().from(teams).where(inArray(teams.id, teamIds))
		: [];
	const teamNameById = new Map(teamRows.map((team) => [team.id, team.name]));

	return {
		finalsBoard: tieRows.map((tie) => ({
			...tie,
			teamAName: tie.teamAId ? (teamNameById.get(tie.teamAId) ?? null) : null,
			teamBName: tie.teamBId ? (teamNameById.get(tie.teamBId) ?? null) : null
		}))
	};
}
