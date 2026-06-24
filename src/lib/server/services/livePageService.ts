import { getRequestDb } from '$lib/server/db/request';
import { rubbers, scoreEvents } from '$lib/server/db/schema';
import { listTeams } from '$lib/server/repositories/tokyoLeagueRepository';
import { getActiveTieBoard, getFinalsTieBoard } from '$lib/server/services/liveBoardService';
import { calculateAllGroupStandings } from '$lib/server/services/standingService';
import { listTies } from '$lib/server/repositories/tokyoLeagueRepository';
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import { buildProgressionFromEvents, type ProgressionEvent } from '$lib/utils/scoreProgression';

export async function getScoreProgressionData() {
	const db = getRequestDb();
	const playingRubbers = await db
		.select({ id: rubbers.id, matchId: rubbers.matchId })
		.from(rubbers)
		.where(and(eq(rubbers.status, 'playing'), isNotNull(rubbers.matchId)));

	if (!playingRubbers.length)
		return {
			byMatchId: {} as Record<string, Array<{ gameNo: number; scoreA: number; scoreB: number }>>,
			eventsByMatchId: {} as Record<string, ProgressionEvent[]>
		};

	const matchIds = playingRubbers.map((r) => r.matchId as string);
	const allEvents = await db
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

export async function getLivePageData() {
	const [activeTies, allStandings, finalsBoard, schedule, teams, progression] = await Promise.all([
		getActiveTieBoard(),
		calculateAllGroupStandings(),
		getFinalsTieBoard(),
		listTies(),
		listTeams(),
		getScoreProgressionData()
	]);

	const groupA = schedule.filter((t) => t.phase === 'group_a');
	const groupB = schedule.filter((t) => t.phase === 'group_b');

	return {
		activeTies,
		standings: { standingA: allStandings.A, standingB: allStandings.B, groupA, groupB, teams },
		finalsBoard,
		schedule,
		progression
	};
}

export type LivePageData = Awaited<ReturnType<typeof getLivePageData>>;
