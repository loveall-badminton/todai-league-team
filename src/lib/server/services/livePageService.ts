import { getRequestDb } from '$lib/server/db/request';
import { rubbers, scoreEvents } from '$lib/server/db/schema';
import { listGroupTies, listTeams, listTies } from '$lib/server/repositories/tokyoLeagueRepository';
import { getActiveTieBoard, getFinalsTieBoard } from '$lib/server/services/liveBoardService';
import { calculateGroupStandings } from '$lib/server/services/standingService';
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
	const [activeTies, standings, finalsBoard, schedule, progression] = await Promise.all([
		getActiveTieBoard(),
		(async () => {
			const [standingA, standingB, groupA, groupB, teams] = await Promise.all([
				calculateGroupStandings('A'),
				calculateGroupStandings('B'),
				listGroupTies('A'),
				listGroupTies('B'),
				listTeams()
			]);
			return { standingA, standingB, groupA, groupB, teams };
		})(),
		getFinalsTieBoard(),
		listTies(),
		getScoreProgressionData()
	]);

	return { activeTies, standings, finalsBoard, schedule, progression };
}

export type LivePageData = Awaited<ReturnType<typeof getLivePageData>>;
