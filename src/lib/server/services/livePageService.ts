import { getRequestDb } from '$lib/server/db/request';
import { rubbers, scoreEvents } from '$lib/server/db/schema';
import { listTeams } from '$lib/server/repositories/tokyoLeagueRepository';
import { getActiveTieBoard, getFinalsTieBoard } from '$lib/server/services/liveBoardService';
import { calculateAllGroupStandings } from '$lib/server/services/standingService';
import { listTies } from '$lib/server/repositories/tokyoLeagueRepository';
import { and, asc, inArray, isNotNull } from 'drizzle-orm';
import { buildProgressionFromEvents, type ProgressionEvent } from '$lib/utils/scoreProgression';

const PROGRESSION_ACTIVE_STATUSES = ['playing'] as const;

export async function getScoreProgressionData() {
	const db = getRequestDb();
	const activeRubbers = await db
		.select({ id: rubbers.id, matchId: rubbers.matchId })
		.from(rubbers)
		.where(and(inArray(rubbers.status, PROGRESSION_ACTIVE_STATUSES), isNotNull(rubbers.matchId)));

	if (!activeRubbers.length)
		return {
			byMatchId: {} as Record<string, Array<{ gameNo: number; scoreA: number; scoreB: number }>>,
			eventsByMatchId: {} as Record<string, ProgressionEvent[]>
		};

	const matchIds = activeRubbers.map((r) => r.matchId as string);

	// Batch match IDs to stay under D1's 100 bind variable limit
	// Each batch: ≤99 IN values + 1 LIMIT = ≤100 total bind vars
	const BATCH_SIZE = 99;
	const rows: Array<{
		matchId: string | null;
		seqNo: number;
		eventType: string;
		gameNo: number | null;
		scoreA: number | null;
		scoreB: number | null;
		targetSeqNo: number | null;
	}> = [];
	for (let i = 0; i < matchIds.length; i += BATCH_SIZE) {
		const batch = matchIds.slice(i, i + BATCH_SIZE);
		const batchRows = await db
			.select({
				matchId: scoreEvents.matchId,
				seqNo: scoreEvents.seqNo,
				eventType: scoreEvents.eventType,
				gameNo: scoreEvents.gameNo,
				scoreA: scoreEvents.scoreAAfter,
				scoreB: scoreEvents.scoreBAfter,
				targetSeqNo: scoreEvents.targetSeqNo
			})
			.from(scoreEvents)
			.where(inArray(scoreEvents.matchId, batch))
			.orderBy(asc(scoreEvents.matchId), asc(scoreEvents.seqNo))
			.limit(1000);
		rows.push(...batchRows);
	}

	const allEvents = rows;

	const eventsByMatchId: Record<string, ProgressionEvent[]> = {};
	for (const e of allEvents) {
		if (!e.matchId) continue;
		(eventsByMatchId[e.matchId] ??= []).push({
			type: e.eventType,
			seqNo: e.seqNo,
			gameNo: e.gameNo,
			scoreA: e.scoreA,
			scoreB: e.scoreB,
			targetSeqNo: e.targetSeqNo
		});
	}

	const byMatchId: Record<string, Array<{ gameNo: number; scoreA: number; scoreB: number }>> = {};
	for (const [matchId, events] of Object.entries(eventsByMatchId)) {
		byMatchId[matchId] = buildProgressionFromEvents(events);
	}

	return { byMatchId, eventsByMatchId };
}

async function runBatched<T extends (() => Promise<unknown>)[]>(
	tasks: [...T],
	batchSize = 3
): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
	const results: unknown[] = [];
	for (let i = 0; i < tasks.length; i += batchSize) {
		const batch = tasks.slice(i, i + batchSize);
		const batchResults = await Promise.all(batch.map((fn) => fn()));
		results.push(...batchResults);
	}
	return results as never;
}

export async function getLivePageData() {
	const [activeTiesRaw, allStandings, finalsBoardRaw, scheduleRaw, teamsRaw] = await runBatched([
		getActiveTieBoard,
		calculateAllGroupStandings,
		getFinalsTieBoard,
		listTies,
		listTeams
	]);

	// 1. Map schedule to only required fields
	const schedule = scheduleRaw.map((t) => ({
		id: t.id,
		tieCode: t.tieCode,
		teamAId: t.teamAId,
		teamBId: t.teamBId,
		winnerTeamId: t.winnerTeamId,
		scheduledStartAt: t.scheduledStartAt,
		teamAName: t.teamAName,
		teamBName: t.teamBName,
		status: t.status,
		teamScoreA: t.teamScoreA,
		teamScoreB: t.teamScoreB,
		phase: t.phase
	}));

	const groupA = schedule.filter((t) => t.phase === 'group_a');
	const groupB = schedule.filter((t) => t.phase === 'group_b');

	// 2. Map teams to only id and name
	const teams = teamsRaw.map((t) => ({
		id: t.id,
		name: t.name
	}));

	// 3. Map standings (allStandings A & B rows)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const mapStandingRow = (row: any) => ({
		teamId: row.teamId,
		teamName: row.teamName,
		rank: row.rank,
		teamMatchesWon: row.teamMatchesWon,
		teamMatchesLost: row.teamMatchesLost,
		rubbersWon: row.rubbersWon,
		rubbersLost: row.rubbersLost,
		gamesWon: row.gamesWon,
		gamesLost: row.gamesLost,
		headToHeadSummary: row.headToHeadSummary,
		tiedTeamsRubbersWon: row.tiedTeamsRubbersWon,
		tiedTeamsGamesWon: row.tiedTeamsGamesWon,
		requiresTiebreaker: row.requiresTiebreaker,
		manualRank: row.manualRank
	});

	const standingA = allStandings.A.map(mapStandingRow);
	const standingB = allStandings.B.map(mapStandingRow);

	// 4. Map finalsBoard
	const finalsBoard = {
		finalsBoard: finalsBoardRaw.finalsBoard.map((t) => ({
			id: t.id,
			phase: t.phase,
			teamAName: t.teamAName,
			teamBName: t.teamBName,
			teamScoreA: t.teamScoreA,
			teamScoreB: t.teamScoreB,
			status: t.status
		}))
	};

	// 5. Map activeTies
	const activeTies = {
		ties: activeTiesRaw.ties.map((t) => ({
			id: t.id,
			phase: t.phase,
			tieCode: t.tieCode,
			venue: t.venue,
			courtBlockCode: t.courtBlockCode,
			teamAName: t.teamAName,
			teamBName: t.teamBName,
			teamScoreA: t.teamScoreA,
			teamScoreB: t.teamScoreB,
			teamAId: t.teamAId,
			teamBId: t.teamBId,
			status: t.status
		})),
		rubbersByTieId: Object.fromEntries(
			Object.entries(activeTiesRaw.rubbersByTieId).map(([tieId, rubbers]) => [
				tieId,
				rubbers.map((r) => ({
					id: r.id,
					code: r.code,
					matchId: r.matchId,
					status: r.status,
					matchStatus: r.matchStatus,
					winnerSide: r.winnerSide,
					sideAPlayers: r.sideAPlayers,
					sideBPlayers: r.sideBPlayers,
					gamesScore: r.gamesScore,
					pointScore: r.pointScore,
					gameDetails: r.gameDetails.map((g) => ({
						gameNo: g.gameNo,
						scoreA: g.scoreA,
						scoreB: g.scoreB
					}))
				}))
			])
		)
	};

	return {
		activeTies,
		standings: { standingA, standingB, groupA, groupB, teams },
		finalsBoard,
		schedule
	};
}

export type LivePageData = Awaited<ReturnType<typeof getLivePageData>>;
export type ScoreProgressionData = Awaited<ReturnType<typeof getScoreProgressionData>>;
