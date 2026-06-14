import { query } from '$app/server';
import { getRequestDb } from '$lib/server/db/request';
import { rubbers, scoreEvents } from '$lib/server/db/schema';
import { listGroupTies, listTeams, listTies } from '$lib/server/repositories/tokyoLeagueRepository';
import { getActiveTieBoard, getFinalsTieBoard } from '$lib/server/services/liveBoardService';
import { calculateGroupStandings } from '$lib/server/services/standingService';
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';

export const getActiveTies = query(async () => {
	return getActiveTieBoard();
});

export const getGroupStandings = query(async () => {
	const [standingA, standingB, groupATies, groupBTies, teams] = await Promise.all([
		calculateGroupStandings('A'),
		calculateGroupStandings('B'),
		listGroupTies('A'),
		listGroupTies('B'),
		listTeams()
	]);
	return { standingA, standingB, groupA: groupATies, groupB: groupBTies, teams };
});

export const getFinalsBoard = query(async () => {
	return getFinalsTieBoard();
});

export const getSchedule = query(async () => {
	return listTies();
});

export const getScoreProgression = query(async () => {
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

	// Build per-match set of undone seqNos
	const undoneByMatchId: Record<string, Set<number>> = {};
	for (const e of allEvents) {
		if (e.eventType === 'undo_applied' && e.matchId && e.targetSeqNo != null) {
			(undoneByMatchId[e.matchId] ??= new Set()).add(e.targetSeqNo);
		}
	}

	const byMatchId: Record<string, Array<{ gameNo: number; scoreA: number; scoreB: number }>> = {};
	for (const e of allEvents) {
		if (
			e.eventType === 'rally_won' &&
			e.matchId &&
			e.gameNo != null &&
			e.scoreA != null &&
			e.scoreB != null &&
			!undoneByMatchId[e.matchId]?.has(e.seqNo)
		) {
			(byMatchId[e.matchId] ??= []).push({ gameNo: e.gameNo, scoreA: e.scoreA, scoreB: e.scoreB });
		}
	}
	return { byMatchId };
});
