import { getRequestDb } from '$lib/server/db/request';
import { rubbers, scoreEvents } from '$lib/server/db/schema';
import { listGroupTies, listTeams, listTies } from '$lib/server/repositories/tokyoLeagueRepository';
import { getActiveTieBoard, getFinalsTieBoard } from '$lib/server/services/liveBoardService';
import { calculateGroupStandings } from '$lib/server/services/standingService';
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';

export async function getScoreProgressionData() {
	const db = getRequestDb();
	const playingRubbers = await db
		.select({ id: rubbers.id, matchId: rubbers.matchId })
		.from(rubbers)
		.where(and(eq(rubbers.status, 'playing'), isNotNull(rubbers.matchId)));

	if (!playingRubbers.length)
		return {
			byMatchId: {} as Record<string, Array<{ gameNo: number; scoreA: number; scoreB: number }>>
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

	const undoneByMatchId: Record<string, Set<number>> = {};
	for (const event of allEvents) {
		if (event.eventType === 'undo_applied' && event.matchId && event.targetSeqNo != null) {
			(undoneByMatchId[event.matchId] ??= new Set()).add(event.targetSeqNo);
		}
	}

	const byMatchId: Record<string, Array<{ gameNo: number; scoreA: number; scoreB: number }>> = {};
	for (const event of allEvents) {
		if (
			event.eventType === 'rally_won' &&
			event.matchId &&
			event.gameNo != null &&
			event.scoreA != null &&
			event.scoreB != null &&
			!undoneByMatchId[event.matchId]?.has(event.seqNo)
		) {
			(byMatchId[event.matchId] ??= []).push({
				gameNo: event.gameNo,
				scoreA: event.scoreA,
				scoreB: event.scoreB
			});
		}
	}

	return { byMatchId };
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
