import { getRequestDb } from '$lib/server/db/request';
import { rubbers, scoreEvents } from '$lib/server/db/schema';
import { listTeams, listTies } from '$lib/server/repositories/tokyoLeagueRepository';
import { calculateAllGroupStandings } from '$lib/server/services/standingService';
import type { GroupStanding } from '$lib/server/services/standingService';
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import { buildProgressionFromEvents, type ProgressionEvent } from '$lib/utils/scoreProgression';

type ScheduleTieRow = Awaited<ReturnType<typeof listTies>>[number];

function mapScheduleTie(t: ScheduleTieRow) {
	return {
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
		phase: t.phase,
		updatedAt: t.updatedAt
	};
}

function mapStandingRow(row: GroupStanding): GroupStanding {
	return {
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
	};
}

function buildStandingsView(params: {
	allStandings: { A: GroupStanding[]; B: GroupStanding[] };
	teamsRaw: Awaited<ReturnType<typeof listTeams>>;
	schedule: ScheduleData;
}) {
	const { allStandings, teamsRaw, schedule } = params;
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
		standingA: allStandings.A.map(mapStandingRow),
		standingB: allStandings.B.map(mapStandingRow),
		groupA: schedule.filter((t) => t.phase === 'group_a'),
		groupB: schedule.filter((t) => t.phase === 'group_b'),
		teams: teamsRaw.map((t) => ({ id: t.id, name: t.name })),
		finalsTies
	};
}

type ProgressionRow = {
	matchId: string | null;
	seqNo: number;
	eventType: string;
	gameNo: number | null;
	scoreA: number | null;
	scoreB: number | null;
	targetSeqNo: number | null;
};

const PROGRESSION_EVENT_COLUMNS = {
	matchId: scoreEvents.matchId,
	seqNo: scoreEvents.seqNo,
	eventType: scoreEvents.eventType,
	gameNo: scoreEvents.gameNo,
	scoreA: scoreEvents.scoreAAfter,
	scoreB: scoreEvents.scoreBAfter,
	targetSeqNo: scoreEvents.targetSeqNo
};

type ProgressionData = {
	byMatchId: Record<string, Array<{ gameNo: number; scoreA: number; scoreB: number }>>;
	eventsByMatchId: Record<string, ProgressionEvent[]>;
};

const EMPTY_PROGRESSION: ProgressionData = { byMatchId: {}, eventsByMatchId: {} };

function buildProgressionData(rows: ProgressionRow[]): ProgressionData {
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

export async function getScheduleData() {
	const tiesRaw = await listTies();
	return tiesRaw.map(mapScheduleTie);
}
export type ScheduleData = Awaited<ReturnType<typeof getScheduleData>>;

export async function getScheduleTieData(tieId: string): Promise<ScheduleData[number] | null> {
	const tiesRaw = await listTies();
	const tie = tiesRaw.find((row) => row.id === tieId);
	return tie ? mapScheduleTie(tie) : null;
}

export async function getStandingsData() {
	const [allStandings, teamsRaw, scheduleRaw] = await Promise.all([
		calculateAllGroupStandings(),
		listTeams(),
		listTies()
	]);

	return buildStandingsView({ allStandings, teamsRaw, schedule: scheduleRaw.map(mapScheduleTie) });
}
export type StandingsData = Awaited<ReturnType<typeof getStandingsData>>;

export async function getScoreProgressionForTie(tieId: string) {
	const db = getRequestDb();
	const activeRubbers = await db
		.select({ id: rubbers.id, matchId: rubbers.matchId })
		.from(rubbers)
		.where(and(eq(rubbers.tieId, tieId), isNotNull(rubbers.matchId)));

	if (!activeRubbers.length) return EMPTY_PROGRESSION;

	const matchIds = activeRubbers.flatMap((r) => (r.matchId ? [r.matchId] : []));
	const rows = await db
		.select(PROGRESSION_EVENT_COLUMNS)
		.from(scoreEvents)
		.where(inArray(scoreEvents.matchId, matchIds))
		.orderBy(asc(scoreEvents.matchId), asc(scoreEvents.seqNo));

	return buildProgressionData(rows);
}
