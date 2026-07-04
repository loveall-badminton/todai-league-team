import type { GameState, MatchPlayer } from '$lib/domain/types';

export type { GameState, MatchPlayer };

export interface EventRow {
	seqNo: number;
	eventType: string;
	side: string | null;
	gameNo: number | null;
	scoreAAfter: number | null;
	scoreBAfter: number | null;
	serverPlayerIdBefore: string | null;
	serverPlayerIdAfter: string | null;
	receiverPlayerIdBefore: string | null;
	receiverPlayerIdAfter: string | null;
	targetSeqNo: number | null;
}

interface ScoreEntry {
	scoreA: number;
	scoreB: number;
	isServiceOver: boolean;
}

interface ServiceRun {
	serverPlayerId: string;
	side: 'A' | 'B';
	scores: ScoreEntry[];
	/** ゲーム開始時に置くレシーバー側の 0(独立した列ではなく開始列に統合する) */
	isPlaceholder?: boolean;
}

export interface GameSheet {
	gameNo: number;
	serviceRuns: ServiceRun[];
	finalScoreA: number;
	finalScoreB: number;
	winnerSide: 'A' | 'B' | null;
}

export function buildScoresheetByGame(
	events: EventRow[],
	games: GameState[],
	players: MatchPlayer[]
): GameSheet[] {
	const allEvents = [...events].sort((a, b) => a.seqNo - b.seqNo);

	// Collect seqNos that have been undone
	const undoneSeqNos = new Set(
		allEvents
			.filter((e) => e.eventType === 'undo_applied' && e.targetSeqNo != null)
			.map((e) => e.targetSeqNo!)
	);
	const activeEvents = allEvents.filter(
		(e) => e.eventType !== 'undo_applied' && !undoneSeqNos.has(e.seqNo)
	);

	const result: GameSheet[] = [];
	let currentGameNo = 1;
	let runs: ServiceRun[] = [];
	let currentRun: ServiceRun | null = null;
	let lastScoreA = 0;
	let lastScoreB = 0;

	for (const ev of activeEvents) {
		// Transition to a new game
		if (ev.eventType === 'game_started' && ev.gameNo && ev.gameNo > currentGameNo) {
			if (currentRun) runs.push(currentRun);
			const gs = games.find((g) => g.gameNo === currentGameNo);
			result.push({
				gameNo: currentGameNo,
				serviceRuns: runs,
				finalScoreA: gs?.score.A ?? lastScoreA,
				finalScoreB: gs?.score.B ?? lastScoreB,
				winnerSide: gs?.winnerSide ?? null
			});
			currentGameNo = ev.gameNo;
			runs = [];
			currentRun = null;
			lastScoreA = 0;
			lastScoreB = 0;
		}

		if (ev.eventType === 'match_started') {
			const serverId = ev.serverPlayerIdAfter;
			const receiverId = ev.receiverPlayerIdAfter;
			const serverSide = players.find((p) => p.id === serverId)?.side ?? ('A' as 'A' | 'B');
			const receiverSide = players.find((p) => p.id === receiverId)?.side ?? ('B' as 'A' | 'B');

			currentRun = {
				serverPlayerId: serverId ?? '',
				side: serverSide,
				scores: [{ scoreA: 0, scoreB: 0, isServiceOver: false }]
			};

			// Receiver's "slot" is pushed first so the server's current run stays in currentRun
			runs.push({
				serverPlayerId: receiverId ?? '',
				side: receiverSide,
				scores: [{ scoreA: 0, scoreB: 0, isServiceOver: true }],
				isPlaceholder: true
			});
		}

		// game_started for the current game number sets the first server/receiver of that game
		if (ev.eventType === 'game_started' && ev.gameNo && ev.gameNo === currentGameNo) {
			const serverId = ev.serverPlayerIdAfter;
			const receiverId = ev.receiverPlayerIdAfter;
			const serverSide = players.find((p) => p.id === serverId)?.side ?? ('A' as 'A' | 'B');
			const receiverSide = players.find((p) => p.id === receiverId)?.side ?? ('B' as 'A' | 'B');

			runs.push({
				serverPlayerId: receiverId ?? '',
				side: receiverSide,
				scores: [{ scoreA: 0, scoreB: 0, isServiceOver: true }],
				isPlaceholder: true
			});

			currentRun = {
				serverPlayerId: serverId ?? '',
				side: serverSide,
				scores: [{ scoreA: 0, scoreB: 0, isServiceOver: false }]
			};
		}

		if (ev.eventType === 'rally_won' && ev.scoreAAfter !== null && ev.scoreBAfter !== null) {
			let scoreA = ev.scoreAAfter;
			let scoreB = ev.scoreBAfter;
			const serverBefore = ev.serverPlayerIdBefore;
			const serverAfter = ev.serverPlayerIdAfter;

			// When the game/match ends, serverAfter is cleared.
			// Historical events may record scoreAAfter=0 due to a bug; use the game state instead.
			if (serverAfter === null) {
				const gs = games.find((g) => g.gameNo === currentGameNo);
				if (gs && gs.winnerSide) {
					scoreA = gs.score.A;
					scoreB = gs.score.B;
				}
			}

			const serverBeforeSide = players.find((p) => p.id === serverBefore)?.side;
			// Service changes either when the server player changes (normal case) or when the
			// receiver wins the game-ending rally (serverAfter=null, ev.side !== serverBeforeSide).
			const serviceChanged =
				serverAfter !== null
					? serverBefore !== serverAfter
					: ev.side !== null && serverBeforeSide !== undefined && ev.side !== serverBeforeSide;

			if (serviceChanged && currentRun) {
				if (currentRun.scores.length > 0) {
					currentRun.scores[currentRun.scores.length - 1].isServiceOver = true;
				}
				runs.push(currentRun);
				const newServerId = serverAfter ?? ev.receiverPlayerIdBefore ?? '';
				const newServerSide = players.find((p) => p.id === newServerId)?.side ?? ('A' as 'A' | 'B');
				currentRun = {
					serverPlayerId: newServerId,
					side: newServerSide,
					scores: [{ scoreA, scoreB, isServiceOver: false }]
				};
			} else if (currentRun) {
				currentRun.scores.push({ scoreA, scoreB, isServiceOver: false });
			} else {
				// rally_won before match_started (edge case)
				const sid = serverAfter ?? '';
				const ss = players.find((p) => p.id === sid)?.side ?? ('A' as 'A' | 'B');
				currentRun = {
					serverPlayerId: sid,
					side: ss,
					scores: [{ scoreA, scoreB, isServiceOver: false }]
				};
			}

			lastScoreA = scoreA;
			lastScoreB = scoreB;
		}
	}

	if (currentRun) runs.push(currentRun);
	if (runs.length > 0) {
		const gs = games.find((g) => g.gameNo === currentGameNo);
		result.push({
			gameNo: currentGameNo,
			serviceRuns: runs,
			finalScoreA: gs?.score.A ?? lastScoreA,
			finalScoreB: gs?.score.B ?? lastScoreB,
			winnerSide: gs?.winnerSide ?? null
		});
	}

	return result;
}

export interface SheetCell {
	playerId: string;
	side: 'A' | 'B';
	scoreA: number;
	scoreB: number;
}

export interface SheetColumn {
	cells: SheetCell[];
	/** この列の後にサービスオーバーの太線を引く */
	serviceOver: boolean;
}

/**
 * サービスラン列を表示用の列に変換する。紙のスコアシートと同様、
 * ゲーム開始時のサーバー 0 とレシーバー 0(placeholder)は同じ列に置く。
 */
export function buildSheetColumns(sheet: GameSheet): SheetColumn[] {
	const columns: SheetColumn[] = [];
	let pending: SheetCell[] = [];

	for (const run of sheet.serviceRuns) {
		if (run.isPlaceholder) {
			pending.push({ playerId: run.serverPlayerId, side: run.side, scoreA: 0, scoreB: 0 });
			continue;
		}
		run.scores.forEach((entry, i) => {
			const cells: SheetCell[] = [
				{ playerId: run.serverPlayerId, side: run.side, scoreA: entry.scoreA, scoreB: entry.scoreB }
			];
			if (i === 0 && pending.length > 0) {
				cells.push(...pending);
				pending = [];
			}
			columns.push({ cells, serviceOver: entry.isServiceOver });
		});
	}
	if (pending.length > 0) columns.push({ cells: pending, serviceOver: false });

	return columns;
}
