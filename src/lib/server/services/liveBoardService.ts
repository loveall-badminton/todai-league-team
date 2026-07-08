import { asc, eq, inArray } from 'drizzle-orm';
import * as v from 'valibot';
import {
	isActiveMatchStatus,
	isResultMatchStatus,
	rubberStatusForMatchStatus
} from '$lib/domain/matchStatus';
import { MatchStateSchema } from '$lib/domain/schemas';
import { getRequestDb } from '$lib/server/db/request';
import { batchQuery } from '$lib/server/db/utils';
import {
	lineupItems,
	lineupSubmissions,
	matches,
	matchSnapshots,
	rubbers,
	teamPlayers,
	teams,
	ties
} from '$lib/server/db/schema';

export type LiveGameScore = {
	gameNo: number;
	scoreA: number;
	scoreB: number;
	winnerSide: 'A' | 'B' | null;
};

export type PublicRubberSummary = typeof rubbers.$inferSelect & {
	winnerSide: 'A' | 'B' | null;
	matchStatus: typeof matches.$inferSelect.status | null;
	lastSeqNo: number | null;
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
	| 'id'
	| 'gamesWonA'
	| 'gamesWonB'
	| 'currentScoreA'
	| 'currentScoreB'
	| 'currentGameNo'
	| 'status'
	| 'lastSeqNo'
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
	const [summaries] = await getBatchedPublicRubbers([tieId], { revealed });
	return summaries ?? [];
}

// 各ゲームのスコアは matchSnapshots の MatchState(常に正)から取得する。
// スコアイベント全走査(試合あたり100行超)に比べ、試合あたり1行の読み込みで済む。
async function fetchLiveGameScores(matchIds: string[]): Promise<PublicGameScoreInput[]> {
	if (matchIds.length === 0) return [];
	const db = getRequestDb();

	const snapshots = await batchQuery(matchIds, async (batch) =>
		db
			.select({ matchId: matchSnapshots.matchId, stateJson: matchSnapshots.stateJson })
			.from(matchSnapshots)
			.where(inArray(matchSnapshots.matchId, batch))
	);

	const results: PublicGameScoreInput[] = [];
	for (const snapshot of snapshots) {
		let state: v.InferOutput<typeof MatchStateSchema>;
		try {
			const parsed = v.safeParse(MatchStateSchema, JSON.parse(snapshot.stateJson));
			if (!parsed.success) continue;
			state = parsed.output;
		} catch {
			continue;
		}
		for (const game of state.games) {
			results.push({
				matchId: snapshot.matchId,
				gameNo: game.gameNo,
				scoreA: game.score.A,
				scoreB: game.score.B
			});
		}
	}
	return results;
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
			lastSeqNo: match?.lastSeqNo ?? null,
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
	return rubberStatusForMatchStatus(match.status) ?? currentStatus;
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
	// cancelled は打ち切り時点のスコアを matches テーブルから表示するため active 扱い
	const isActive = isActiveMatchStatus(match.status) || match.status === 'cancelled';
	const isEnded = isResultMatchStatus(match.status);

	if (isActive) {
		// Use live score from matches table (most current)
		gameDetails.push({
			gameNo: match.currentGameNo,
			scoreA: match.currentScoreA,
			scoreB: match.currentScoreB,
			winnerSide: null
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

// オーダーは対戦開始(playing)以降に一般公開される
function lineupsRevealedForTieStatus(tieStatus: string): boolean {
	return ['playing', 'finished', 'confirmed'].includes(tieStatus);
}

// tie に紐づくチーム名を解決して各行に付与する
async function attachTeamNames<T extends { teamAId: string | null; teamBId: string | null }>(
	rows: T[]
): Promise<(T & { teamAName: string | null; teamBName: string | null })[]> {
	const db = getRequestDb();
	const teamIds = [
		...new Set(rows.flatMap((t) => [t.teamAId, t.teamBId]).filter((id): id is string => !!id))
	];
	const teamRows = teamIds.length
		? await db.select().from(teams).where(inArray(teams.id, teamIds))
		: [];
	const teamNameById = new Map(teamRows.map((team) => [team.id, team.name]));
	return rows.map((row) => ({
		...row,
		teamAName: row.teamAId ? (teamNameById.get(row.teamAId) ?? null) : null,
		teamBName: row.teamBId ? (teamNameById.get(row.teamBId) ?? null) : null
	}));
}

export async function getPublicRubbers(tieId: string): Promise<PublicRubberSummary[]> {
	const db = getRequestDb();
	const tie = await db.query.ties.findFirst({ where: eq(ties.id, tieId) });
	if (!tie) return [];
	return getPublicRubbersForTie(tieId, lineupsRevealedForTieStatus(tie.status));
}

export async function getBatchedPublicRubbers(
	tieIds: string[],
	options: { revealed?: boolean } = {}
): Promise<PublicRubberSummary[][]> {
	if (!tieIds.length) return [];

	const db = getRequestDb();
	const revealed = options.revealed ?? true;

	// 1. Fetch all rubbers for all ties
	// (各 tie は必ず単一チャンクに収まるため tie 内の displayOrder 順は保たれる)
	const allRubbers = await batchQuery(tieIds, (batch) =>
		db
			.select()
			.from(rubbers)
			.where(inArray(rubbers.tieId, batch))
			.orderBy(asc(rubbers.displayOrder))
	);

	const matchIds = allRubbers.map((r) => r.matchId).filter((id): id is string => !!id);

	// 2. Fetch all matches
	const allMatches = await batchQuery(matchIds, (batch) =>
		db
			.select({
				id: matches.id,
				gamesWonA: matches.gamesWonA,
				gamesWonB: matches.gamesWonB,
				currentScoreA: matches.currentScoreA,
				currentScoreB: matches.currentScoreB,
				currentGameNo: matches.currentGameNo,
				status: matches.status,
				lastSeqNo: matches.lastSeqNo
			})
			.from(matches)
			.where(inArray(matches.id, batch))
	);

	// 3. Fetch all game scores
	const allGameScores = await fetchLiveGameScores(matchIds);

	// 4. Fetch all lineup submissions
	const allSubmissions = revealed
		? await batchQuery(tieIds, (batch) =>
				db.select().from(lineupSubmissions).where(inArray(lineupSubmissions.tieId, batch))
			)
		: [];

	const submissionIds = allSubmissions.map((s) => s.id);

	// 5. Fetch all lineup items
	const allItems = revealed
		? await batchQuery(submissionIds, (batch) =>
				db.select().from(lineupItems).where(inArray(lineupItems.submissionId, batch))
			)
		: [];

	const playerIds = allItems
		.flatMap((item) => [item.player1Id, item.player2Id])
		.filter((id): id is string => !!id);

	// 6. Fetch all players
	const allPlayers = revealed
		? await batchQuery(playerIds, (batch) =>
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

export async function getTiePageData(tieId: string) {
	const db = getRequestDb();
	const tie = await db.query.ties.findFirst({ where: eq(ties.id, tieId) });
	if (!tie) return null;

	const revealed = lineupsRevealedForTieStatus(tie.status);

	const [[tieWithTeamNames], rubberData] = await Promise.all([
		attachTeamNames([tie]),
		getPublicRubbersForTie(tieId, revealed)
	]);

	return {
		tie: {
			id: tie.id,
			phase: tie.phase,
			tieCode: tie.tieCode,
			status: tie.status,
			teamAId: tie.teamAId,
			teamBId: tie.teamBId,
			teamAName: tieWithTeamNames.teamAName,
			teamBName: tieWithTeamNames.teamBName,
			teamScoreA: tie.teamScoreA,
			teamScoreB: tie.teamScoreB,
			venue: tie.venue,
			courtBlockCode: tie.courtBlockCode,
			scheduledStartAt: tie.scheduledStartAt
		},
		rubbers: rubberData.map((r) => ({
			id: r.id,
			code: r.code,
			matchId: r.matchId,
			status: r.status,
			matchStatus: r.matchStatus,
			lastSeqNo: r.lastSeqNo,
			winnerSide: r.winnerSide,
			sideAPlayers: r.sideAPlayers,
			sideBPlayers: r.sideBPlayers,
			gamesScore: r.gamesScore,
			pointScore: r.pointScore,
			gameDetails: r.gameDetails.map((g) => ({
				gameNo: g.gameNo,
				scoreA: g.scoreA,
				scoreB: g.scoreB,
				winnerSide: g.winnerSide
			}))
		}))
	};
}
export type TiePageData = NonNullable<Awaited<ReturnType<typeof getTiePageData>>>;
