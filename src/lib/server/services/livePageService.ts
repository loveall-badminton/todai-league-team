import { getRequestDb } from '$lib/server/db/request';
import type { PublicRubberSummary } from '$lib/server/services/liveBoardService';
import { rubbers, scoreEvents, ties } from '$lib/server/db/schema';
import { listTeams } from '$lib/server/repositories/tokyoLeagueRepository';
import { getActiveTieBoard, getFinalsTieBoard } from '$lib/server/services/liveBoardService';
import { calculateAllGroupStandings } from '$lib/server/services/standingService';
import type { GroupStanding } from '$lib/server/services/standingService';
import { listTies } from '$lib/server/repositories/tokyoLeagueRepository';
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import { buildProgressionFromEvents, type ProgressionEvent } from '$lib/utils/scoreProgression';

const PROGRESSION_ACTIVE_STATUSES = ['playing'] as const;

type LivePageActiveRubber = Pick<
	PublicRubberSummary,
	| 'id'
	| 'code'
	| 'matchId'
	| 'status'
	| 'matchStatus'
	| 'winnerSide'
	| 'sideAPlayers'
	| 'sideBPlayers'
	| 'gamesScore'
	| 'pointScore'
	| 'gameDetails'
>;

type LivePageDataShape = {
	activeTies: {
		ties: Array<{
			id: string;
			phase: typeof ties.$inferSelect.phase;
			tieCode: string;
			venue: typeof ties.$inferSelect.venue;
			courtBlockCode: string | null;
			teamAName: string | null;
			teamBName: string | null;
			teamScoreA: number;
			teamScoreB: number;
			teamAId: string | null;
			teamBId: string | null;
			status: typeof ties.$inferSelect.status;
		}>;
		rubbersByTieId: Record<string, LivePageActiveRubber[]>;
	};
	standings: {
		standingA: GroupStanding[];
		standingB: GroupStanding[];
		groupA: ScheduleData;
		groupB: ScheduleData;
		teams: Array<{ id: string; name: string }>;
		finalsTies: Array<{
			id: string;
			tieCode: string;
			phase: typeof ties.$inferSelect.phase;
			teamAId: string | null;
			teamBId: string | null;
			teamAName: string | null;
			teamBName: string | null;
			winnerTeamId: string | null;
			status: typeof ties.$inferSelect.status;
		}>;
	};
	finalsBoard: {
		finalsBoard: Array<{
			id: string;
			phase: typeof ties.$inferSelect.phase;
			teamAName: string | null;
			teamBName: string | null;
			teamScoreA: number;
			teamScoreB: number;
			status: typeof ties.$inferSelect.status;
		}>;
	};
	schedule: ScheduleData;
};

export async function getScoreProgressionData() {
	const db = getRequestDb();
	const activeRubbers = await db
		.select({ id: rubbers.id, matchId: rubbers.matchId })
		.from(rubbers)
		.where(and(inArray(rubbers.status, PROGRESSION_ACTIVE_STATUSES), isNotNull(rubbers.matchId)));

	if (!activeRubbers.length)
		return {
			byMatchId: {} satisfies Record<
				string,
				Array<{ gameNo: number; scoreA: number; scoreB: number }>
			>,
			eventsByMatchId: {} satisfies Record<string, ProgressionEvent[]>
		};

	const matchIds = activeRubbers.flatMap((r) => (r.matchId ? [r.matchId] : []));

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

async function getLivePageParts() {
	const [activeTiesRaw, allStandings, finalsBoardRaw, scheduleRaw, teamsRaw] = await Promise.all([
		getActiveTieBoard(),
		calculateAllGroupStandings(),
		getFinalsTieBoard(),
		listTies(),
		listTeams()
	]);

	return { activeTiesRaw, allStandings, finalsBoardRaw, scheduleRaw, teamsRaw };
}

export async function getLivePageData(): Promise<LivePageDataShape> {
	const { activeTiesRaw, allStandings, finalsBoardRaw, scheduleRaw, teamsRaw } =
		await getLivePageParts();

	// 1. Map schedule to only required fields
	const schedule = scheduleRaw.map((t) => ({
		id: t.id,
		tieCode: t.tieCode,
		teamAId: t.teamAId,
		teamBId: t.teamBId,
		winnerTeamId: t.winnerTeamId,
		scheduledStartAt: t.scheduledStartAt,
		lineupDueAt: t.lineupDueAt,
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
	const mapStandingRow = (row: GroupStanding): GroupStanding => ({
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
		requiresTiebreaker: !!row.requiresTiebreaker,
		manualRank: row.manualRank
	});

	const standingA = allStandings.A.map(mapStandingRow);
	const standingB = allStandings.B.map(mapStandingRow);

	// 4. Map finalsBoard
	const finalsBoard: LivePageDataShape['finalsBoard'] = {
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
	const activeTies: LivePageDataShape['activeTies'] = {
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
			Object.entries(activeTiesRaw.rubbersByTieId).map(
				([tieId, rubbers]): [string, LivePageActiveRubber[]] => [
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
							scoreB: g.scoreB,
							winnerSide: g.winnerSide ?? null
						}))
					}))
				]
			)
		)
	};

	const finalsTies = schedule
		.filter((t) => ['final', 'third_place', 'fifth_place'].includes(t.phase))
		.map((t) => ({
			id: t.id,
			tieCode: t.tieCode,
			phase: t.phase,
			teamAId: t.teamAId,
			teamBId: t.teamBId,
			teamAName: t.teamAName,
			teamBName: t.teamBName,
			winnerTeamId: t.winnerTeamId,
			status: t.status
		}));

	return {
		activeTies,
		standings: { standingA, standingB, groupA, groupB, teams, finalsTies },
		finalsBoard,
		schedule
	};
}

export type LivePageData = LivePageDataShape;
export type ScoreProgressionData = Awaited<ReturnType<typeof getScoreProgressionData>>;

// ── Per-page data functions (lighter than full getLivePageData) ──────────────

export async function getScheduleData() {
	const tiesRaw = await listTies();
	return tiesRaw.map((t) => ({
		id: t.id,
		tieCode: t.tieCode,
		teamAId: t.teamAId,
		teamBId: t.teamBId,
		winnerTeamId: t.winnerTeamId,
		scheduledStartAt: t.scheduledStartAt,
		lineupDueAt: t.lineupDueAt,
		teamAName: t.teamAName,
		teamBName: t.teamBName,
		status: t.status,
		teamScoreA: t.teamScoreA,
		teamScoreB: t.teamScoreB,
		phase: t.phase
	}));
}
export type ScheduleData = Awaited<ReturnType<typeof getScheduleData>>;

export async function getStandingsData() {
	const [allStandings, teamsRaw, scheduleRaw] = await Promise.all([
		calculateAllGroupStandings(),
		listTeams(),
		listTies()
	]);

	const schedule = scheduleRaw.map((t) => ({
		id: t.id,
		tieCode: t.tieCode,
		teamAId: t.teamAId,
		teamBId: t.teamBId,
		winnerTeamId: t.winnerTeamId,
		scheduledStartAt: t.scheduledStartAt,
		lineupDueAt: t.lineupDueAt,
		teamAName: t.teamAName,
		teamBName: t.teamBName,
		status: t.status,
		teamScoreA: t.teamScoreA,
		teamScoreB: t.teamScoreB,
		phase: t.phase
	}));
	const groupA = schedule.filter((t) => t.phase === 'group_a');
	const groupB = schedule.filter((t) => t.phase === 'group_b');
	const teams = teamsRaw.map((t) => ({ id: t.id, name: t.name }));

	const finalsTies = schedule
		.filter((t) => ['final', 'third_place', 'fifth_place'].includes(t.phase))
		.map((t) => ({
			id: t.id,
			tieCode: t.tieCode,
			phase: t.phase,
			teamAId: t.teamAId,
			teamBId: t.teamBId,
			teamAName: t.teamAName,
			teamBName: t.teamBName,
			winnerTeamId: t.winnerTeamId,
			status: t.status
		}));

	const mapStandingRow = (row: GroupStanding): GroupStanding => ({
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
		requiresTiebreaker: !!row.requiresTiebreaker,
		manualRank: row.manualRank
	});

	return {
		standingA: allStandings.A.map(mapStandingRow),
		standingB: allStandings.B.map(mapStandingRow),
		groupA,
		groupB,
		teams,
		finalsTies
	};
}
export type StandingsData = Awaited<ReturnType<typeof getStandingsData>>;

export async function getScoreProgressionForTie(tieId: string) {
	const db = getRequestDb();
	const activeRubbers = await db
		.select({ id: rubbers.id, matchId: rubbers.matchId })
		.from(rubbers)
		.where(and(eq(rubbers.tieId, tieId), isNotNull(rubbers.matchId)));

	if (!activeRubbers.length)
		return {
			byMatchId: {} satisfies Record<
				string,
				Array<{ gameNo: number; scoreA: number; scoreB: number }>
			>,
			eventsByMatchId: {} satisfies Record<string, ProgressionEvent[]>
		};

	const matchIds = activeRubbers.flatMap((r) => (r.matchId ? [r.matchId] : []));
	const rows = await db
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
		.where(inArray(scoreEvents.matchId, matchIds))
		.orderBy(asc(scoreEvents.matchId), asc(scoreEvents.seqNo));

	const eventsByMatchId: Record<string, ProgressionEvent[]> = {};
	for (const e of rows) {
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
