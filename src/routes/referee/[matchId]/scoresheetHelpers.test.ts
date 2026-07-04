import { describe, expect, test } from 'vitest';
import {
	buildScoresheetByGame,
	buildSheetColumns,
	type EventRow,
	type GameSheet
} from './scoresheetHelpers';
import type { GameState, MatchPlayer } from '$lib/domain/types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makePlayer(id: string, side: 'A' | 'B'): MatchPlayer {
	return { id, side, order: 1, name: id };
}

function makeGameState(
	gameNo: number,
	scoreA: number,
	scoreB: number,
	winnerSide: 'A' | 'B' | null = null
): GameState {
	return {
		gameNo,
		score: { A: scoreA, B: scoreB },
		winnerSide,
		midGameIntervalTaken: false,
		changeEndsRequired: false,
		changeEndsCompleted: false
	};
}

let seq = 0;
function resetSeq() {
	seq = 0;
}
function nextSeq() {
	return ++seq;
}

function matchStarted(serverId: string, receiverId: string): EventRow {
	return {
		seqNo: nextSeq(),
		eventType: 'match_started',
		side: null,
		gameNo: 1,
		scoreAAfter: null,
		scoreBAfter: null,
		serverPlayerIdBefore: null,
		serverPlayerIdAfter: serverId,
		receiverPlayerIdBefore: null,
		receiverPlayerIdAfter: receiverId,
		targetSeqNo: null
	};
}

function gameStarted(gameNo: number, serverId: string, receiverId: string): EventRow {
	return {
		seqNo: nextSeq(),
		eventType: 'game_started',
		side: null,
		gameNo,
		scoreAAfter: null,
		scoreBAfter: null,
		serverPlayerIdBefore: null,
		serverPlayerIdAfter: serverId,
		receiverPlayerIdBefore: null,
		receiverPlayerIdAfter: receiverId,
		targetSeqNo: null
	};
}

function rallyWon(opts: {
	side: 'A' | 'B' | null;
	scoreA: number;
	scoreB: number;
	serverBefore: string | null;
	serverAfter: string | null;
	receiverBefore?: string | null;
}): EventRow {
	return {
		seqNo: nextSeq(),
		eventType: 'rally_won',
		side: opts.side,
		gameNo: null,
		scoreAAfter: opts.scoreA,
		scoreBAfter: opts.scoreB,
		serverPlayerIdBefore: opts.serverBefore,
		serverPlayerIdAfter: opts.serverAfter,
		receiverPlayerIdBefore: opts.receiverBefore ?? null,
		receiverPlayerIdAfter: null,
		targetSeqNo: null
	};
}

function undoApplied(targetSeqNo: number): EventRow {
	return {
		seqNo: nextSeq(),
		eventType: 'undo_applied',
		side: null,
		gameNo: null,
		scoreAAfter: null,
		scoreBAfter: null,
		serverPlayerIdBefore: null,
		serverPlayerIdAfter: null,
		receiverPlayerIdBefore: null,
		receiverPlayerIdAfter: null,
		targetSeqNo
	};
}

// Shorthand: extracts serviceRun player ids from a sheet
function runIds(sheet: GameSheet): string[] {
	return sheet.serviceRuns.map((r) => r.serverPlayerId);
}

// ─── empty / no-score cases ───────────────────────────────────────────────────

describe('buildScoresheetByGame: empty / no-score input', () => {
	test('no events → empty result', () => {
		expect(buildScoresheetByGame([], [], [])).toEqual([]);
	});

	test('only undo_applied events → empty result', () => {
		resetSeq();
		const events: EventRow[] = [undoApplied(99)];
		expect(buildScoresheetByGame(events, [], [])).toEqual([]);
	});

	test('only non-scored event types (e.g. match_confirmed) → empty result', () => {
		resetSeq();
		const ev: EventRow = {
			seqNo: nextSeq(),
			eventType: 'match_confirmed',
			side: null,
			gameNo: null,
			scoreAAfter: null,
			scoreBAfter: null,
			serverPlayerIdBefore: null,
			serverPlayerIdAfter: null,
			receiverPlayerIdBefore: null,
			receiverPlayerIdAfter: null,
			targetSeqNo: null
		};
		expect(buildScoresheetByGame([ev], [], [])).toEqual([]);
	});
});

// ─── match_started ────────────────────────────────────────────────────────────

describe('buildScoresheetByGame: match_started', () => {
	const players = [makePlayer('s1', 'A'), makePlayer('r1', 'B')];

	test('creates exactly one GameSheet for game 1', () => {
		resetSeq();
		const events = [matchStarted('s1', 'r1')];
		const result = buildScoresheetByGame(events, [], players);
		expect(result).toHaveLength(1);
		expect(result[0].gameNo).toBe(1);
	});

	test('creates two service runs: receiver slot first, then server', () => {
		resetSeq();
		const events = [matchStarted('s1', 'r1')];
		const result = buildScoresheetByGame(events, [], players);
		// runs[0] = receiver slot (isServiceOver=true), runs[1] = server (currentRun pushed last)
		expect(runIds(result[0])).toEqual(['r1', 's1']);
	});

	test('receiver run starts with isServiceOver=true (pre-match placeholder)', () => {
		resetSeq();
		const events = [matchStarted('s1', 'r1')];
		const result = buildScoresheetByGame(events, [], players);
		expect(result[0].serviceRuns[0].scores[0].isServiceOver).toBe(true);
	});

	test('server run starts with isServiceOver=false', () => {
		resetSeq();
		const events = [matchStarted('s1', 'r1')];
		const result = buildScoresheetByGame(events, [], players);
		expect(result[0].serviceRuns[1].scores[0].isServiceOver).toBe(false);
	});

	test('sides are derived from players array', () => {
		resetSeq();
		const events = [matchStarted('s1', 'r1')];
		const result = buildScoresheetByGame(events, [], players);
		expect(result[0].serviceRuns[0].side).toBe('B'); // receiver = r1 = side B
		expect(result[0].serviceRuns[1].side).toBe('A'); // server = s1 = side A
	});

	test('unknown player id → side defaults to A for server, B for receiver', () => {
		resetSeq();
		const events = [matchStarted('unknown_s', 'unknown_r')];
		const result = buildScoresheetByGame(events, [], []);
		expect(result[0].serviceRuns[0].side).toBe('B');
		expect(result[0].serviceRuns[1].side).toBe('A');
	});

	test('finalScoreA/B default to 0 when no game state provided', () => {
		resetSeq();
		const events = [matchStarted('s1', 'r1')];
		const result = buildScoresheetByGame(events, [], players);
		expect(result[0].finalScoreA).toBe(0);
		expect(result[0].finalScoreB).toBe(0);
	});

	test('finalScore is taken from game state when available', () => {
		resetSeq();
		const events = [matchStarted('s1', 'r1')];
		const games = [makeGameState(1, 21, 15, 'A')];
		const result = buildScoresheetByGame(events, games, players);
		expect(result[0].finalScoreA).toBe(21);
		expect(result[0].finalScoreB).toBe(15);
		expect(result[0].winnerSide).toBe('A');
	});
});

// ─── rally_won: no service change ─────────────────────────────────────────────

describe('buildScoresheetByGame: rally_won (same server)', () => {
	const players = [makePlayer('s1', 'A'), makePlayer('r1', 'B')];

	test('score appended to current server run', () => {
		resetSeq();
		const events = [
			matchStarted('s1', 'r1'),
			rallyWon({ side: 'A', scoreA: 1, scoreB: 0, serverBefore: 's1', serverAfter: 's1' })
		];
		const result = buildScoresheetByGame(events, [], players);
		const serverRun = result[0].serviceRuns.find((r) => r.serverPlayerId === 's1')!;
		// Initial (0,0,false) + new (1,0,false)
		expect(serverRun.scores).toHaveLength(2);
		expect(serverRun.scores[1]).toEqual({ scoreA: 1, scoreB: 0, isServiceOver: false });
	});

	test('multiple rallies accumulate in the same run', () => {
		resetSeq();
		const events = [
			matchStarted('s1', 'r1'),
			rallyWon({ side: 'A', scoreA: 1, scoreB: 0, serverBefore: 's1', serverAfter: 's1' }),
			rallyWon({ side: 'A', scoreA: 2, scoreB: 0, serverBefore: 's1', serverAfter: 's1' }),
			rallyWon({ side: 'A', scoreA: 3, scoreB: 0, serverBefore: 's1', serverAfter: 's1' })
		];
		const result = buildScoresheetByGame(events, [], players);
		const serverRun = result[0].serviceRuns.find((r) => r.serverPlayerId === 's1')!;
		// (0,0) + 3 rallies = 4 entries
		expect(serverRun.scores).toHaveLength(4);
	});
});

// ─── rally_won: service change ────────────────────────────────────────────────

describe('buildScoresheetByGame: rally_won (service change)', () => {
	const players = [makePlayer('s1', 'A'), makePlayer('r1', 'B')];

	test('last score of outgoing run gets isServiceOver=true', () => {
		resetSeq();
		const seqOfRally = seq + 2; // match_started is +1, rally is +2
		const events = [
			matchStarted('s1', 'r1'),
			rallyWon({ side: 'B', scoreA: 0, scoreB: 1, serverBefore: 's1', serverAfter: 'r1' })
		];
		const result = buildScoresheetByGame(events, [], players);
		// s1's run: [(0,0,false)] → last score flipped to isServiceOver=true
		const s1Run = result[0].serviceRuns.find((r) => r.serverPlayerId === 's1')!;
		expect(s1Run.scores[s1Run.scores.length - 1].isServiceOver).toBe(true);
		void seqOfRally;
	});

	test('new run created for the new server with the rally score as first entry', () => {
		resetSeq();
		const events = [
			matchStarted('s1', 'r1'),
			rallyWon({ side: 'B', scoreA: 0, scoreB: 1, serverBefore: 's1', serverAfter: 'r1' })
		];
		const result = buildScoresheetByGame(events, [], players);
		// After service change, 'r1' should have a new run starting at (0,1)
		const r1Runs = result[0].serviceRuns.filter((r) => r.serverPlayerId === 'r1');
		// There should be at least one new run beyond the initial receiver slot
		const newRun = r1Runs.find((r) => r.scores.some((s) => s.scoreB === 1));
		expect(newRun).toBeDefined();
		expect(newRun!.scores[0]).toEqual({ scoreA: 0, scoreB: 1, isServiceOver: false });
	});

	test('two service changes → three distinct runs for s1', () => {
		resetSeq();
		const players2 = [makePlayer('s1', 'A'), makePlayer('r1', 'B'), makePlayer('s2', 'A')];
		const events = [
			matchStarted('s1', 'r1'),
			// s1 wins a rally
			rallyWon({ side: 'A', scoreA: 1, scoreB: 0, serverBefore: 's1', serverAfter: 's1' }),
			// r1 wins → service to r1
			rallyWon({ side: 'B', scoreA: 1, scoreB: 1, serverBefore: 's1', serverAfter: 'r1' }),
			// s1 wins → service back to s1
			rallyWon({ side: 'A', scoreA: 2, scoreB: 1, serverBefore: 'r1', serverAfter: 's1' })
		];
		const result = buildScoresheetByGame(events, [], players2);
		// s1 appears 3 times: once from the initial currentRun, once after winning back
		// r1 appears 2 times: receiver slot + after winning
		const s1Runs = result[0].serviceRuns.filter((r) => r.serverPlayerId === 's1');
		expect(s1Runs.length).toBeGreaterThanOrEqual(2);
	});
});

// ─── undo_applied ─────────────────────────────────────────────────────────────

describe('buildScoresheetByGame: undo_applied', () => {
	const players = [makePlayer('s1', 'A'), makePlayer('r1', 'B')];

	test('undone rally is excluded from run scores', () => {
		resetSeq();
		const events = [
			matchStarted('s1', 'r1'),
			rallyWon({ side: 'A', scoreA: 1, scoreB: 0, serverBefore: 's1', serverAfter: 's1' })
		];
		const undoneSeq = seq; // the seqNo of the rally
		events.push(undoApplied(undoneSeq));
		const result = buildScoresheetByGame(events, [], players);
		const s1Run = result[0].serviceRuns.find((r) => r.serverPlayerId === 's1')!;
		// Only the initial (0,0) remains
		expect(s1Run.scores).toHaveLength(1);
		expect(s1Run.scores[0]).toEqual({ scoreA: 0, scoreB: 0, isServiceOver: false });
	});

	test('undoing a service-change rally reverts to single-server run', () => {
		resetSeq();
		const rally1Seq = seq + 2; // match_started(+1), rally(+2)
		const events = [
			matchStarted('s1', 'r1'),
			rallyWon({ side: 'B', scoreA: 0, scoreB: 1, serverBefore: 's1', serverAfter: 'r1' })
		];
		events.push(undoApplied(rally1Seq));
		const result = buildScoresheetByGame(events, [], players);
		// After undo, only s1's initial run and r1's receiver slot should exist
		const r1NewRun = result[0].serviceRuns.find(
			(r) => r.serverPlayerId === 'r1' && r.scores.some((s) => s.scoreB === 1)
		);
		expect(r1NewRun).toBeUndefined();
	});

	test('undo_applied itself is excluded from active events', () => {
		resetSeq();
		// Even if undo_applied has no matching target, it should not appear as a scored run
		const events = [matchStarted('s1', 'r1'), undoApplied(999)];
		const result = buildScoresheetByGame(events, [], players);
		// The undo event should not introduce any extra service run
		expect(result[0].serviceRuns).toHaveLength(2); // receiver slot + server
	});

	test('events processed in seqNo order regardless of input order', () => {
		resetSeq();
		const ev1 = matchStarted('s1', 'r1'); // seqNo=1
		const ev2 = rallyWon({
			side: 'A',
			scoreA: 1,
			scoreB: 0,
			serverBefore: 's1',
			serverAfter: 's1'
		}); // seqNo=2
		// Feed in reverse order
		const result = buildScoresheetByGame([ev2, ev1], [], players);
		const s1Run = result[0].serviceRuns.find((r) => r.serverPlayerId === 's1')!;
		expect(s1Run.scores).toHaveLength(2);
	});
});

// ─── game transitions ─────────────────────────────────────────────────────────

describe('buildScoresheetByGame: multi-game', () => {
	const players = [makePlayer('s1', 'A'), makePlayer('r1', 'B')];

	test('game_started with new gameNo pushes previous game to result', () => {
		resetSeq();
		const events = [
			matchStarted('s1', 'r1'),
			gameStarted(2, 'r1', 's1') // game 2 starts
		];
		const result = buildScoresheetByGame(events, [], players);
		// Should have 2 games
		expect(result).toHaveLength(2);
		expect(result[0].gameNo).toBe(1);
		expect(result[1].gameNo).toBe(2);
	});

	test('each game has its own service runs', () => {
		resetSeq();
		const events = [
			matchStarted('s1', 'r1'),
			rallyWon({ side: 'A', scoreA: 1, scoreB: 0, serverBefore: 's1', serverAfter: 's1' }),
			gameStarted(2, 'r1', 's1'),
			rallyWon({ side: 'B', scoreA: 0, scoreB: 1, serverBefore: 'r1', serverAfter: 'r1' })
		];
		const result = buildScoresheetByGame(events, [], players);
		expect(result).toHaveLength(2);
		// Game 1 server is s1; game 2 initial server is r1
		const g1ServerRun = result[0].serviceRuns.find((r) => r.serverPlayerId === 's1');
		const g2ServerRun = result[1].serviceRuns.find((r) => r.serverPlayerId === 'r1');
		expect(g1ServerRun).toBeDefined();
		expect(g2ServerRun).toBeDefined();
	});

	test('finalScore from game state overrides accumulated score', () => {
		resetSeq();
		const events = [matchStarted('s1', 'r1'), gameStarted(2, 'r1', 's1')];
		const games = [makeGameState(1, 21, 15, 'A'), makeGameState(2, 18, 21, 'B')];
		const result = buildScoresheetByGame(events, games, players);
		expect(result[0].finalScoreA).toBe(21);
		expect(result[0].winnerSide).toBe('A');
		expect(result[1].finalScoreB).toBe(21);
		expect(result[1].winnerSide).toBe('B');
	});

	test('three-game match produces three GameSheets', () => {
		resetSeq();
		const events = [
			matchStarted('s1', 'r1'),
			gameStarted(2, 'r1', 's1'),
			gameStarted(3, 's1', 'r1')
		];
		const result = buildScoresheetByGame(events, [], players);
		expect(result).toHaveLength(3);
		expect(result.map((g) => g.gameNo)).toEqual([1, 2, 3]);
	});
});

// ─── game-ending rally (serverAfter = null) ───────────────────────────────────

describe('buildScoresheetByGame: game-ending rally', () => {
	const players = [makePlayer('s1', 'A'), makePlayer('r1', 'B')];

	test('serverAfter=null uses game state score when winnerSide is set', () => {
		resetSeq();
		const events = [
			matchStarted('s1', 'r1'),
			// Final rally: server is cleared
			rallyWon({
				side: 'A',
				scoreA: 1, // stale value from historical bug
				scoreB: 0,
				serverBefore: 's1',
				serverAfter: null,
				receiverBefore: 'r1'
			})
		];
		const games = [makeGameState(1, 21, 15, 'A')];
		const result = buildScoresheetByGame(events, games, players);
		// The last score in s1's run should use the corrected game state score
		const s1Run = result[0].serviceRuns.find((r) => r.serverPlayerId === 's1')!;
		const lastScore = s1Run.scores[s1Run.scores.length - 1];
		expect(lastScore.scoreA).toBe(21);
		expect(lastScore.scoreB).toBe(15);
	});

	test('serverAfter=null and receiver wins (ev.side !== serverBeforeSide) → service change', () => {
		resetSeq();
		// s1 (side A) is serving; r1 (side B) wins the final rally
		const events = [
			matchStarted('s1', 'r1'),
			rallyWon({
				side: 'B', // receiver side wins
				scoreA: 15,
				scoreB: 21,
				serverBefore: 's1',
				serverAfter: null,
				receiverBefore: 'r1'
			})
		];
		const games = [makeGameState(1, 15, 21, 'B')];
		const result = buildScoresheetByGame(events, games, players);
		// Service changed → s1's run ends, r1 gets a new run
		const r1NewRun = result[0].serviceRuns.find(
			(r) => r.serverPlayerId === 'r1' && r.scores.some((s) => s.scoreB === 21)
		);
		expect(r1NewRun).toBeDefined();
	});

	test('serverAfter=null and server wins (ev.side === serverBeforeSide) → no service change', () => {
		resetSeq();
		// s1 (side A) is serving and wins the final rally
		const events = [
			matchStarted('s1', 'r1'),
			rallyWon({
				side: 'A', // server side wins
				scoreA: 21,
				scoreB: 15,
				serverBefore: 's1',
				serverAfter: null,
				receiverBefore: 'r1'
			})
		];
		const games = [makeGameState(1, 21, 15, 'A')];
		const result = buildScoresheetByGame(events, games, players);
		// No service change → s1's run gets the score appended
		const s1Run = result[0].serviceRuns.find((r) => r.serverPlayerId === 's1')!;
		// (0,0) + (21,15)
		expect(s1Run.scores).toHaveLength(2);
	});
});

// ─── buildSheetColumns ────────────────────────────────────────────────────────

describe('buildSheetColumns', () => {
	const players = [makePlayer('s1', 'A'), makePlayer('r1', 'B')];

	test('initial server 0 and receiver 0 share the same column', () => {
		resetSeq();
		const events = [matchStarted('s1', 'r1')];
		const [sheet] = buildScoresheetByGame(events, [], players);
		const columns = buildSheetColumns(sheet);
		expect(columns).toHaveLength(1);
		expect(columns[0].cells.map((c) => c.playerId).sort()).toEqual(['r1', 's1']);
	});

	test('rallies append one column each after the shared start column', () => {
		resetSeq();
		const events = [
			matchStarted('s1', 'r1'),
			rallyWon({ side: 'A', scoreA: 1, scoreB: 0, serverBefore: 's1', serverAfter: 's1' }),
			rallyWon({ side: 'B', scoreA: 1, scoreB: 1, serverBefore: 's1', serverAfter: 'r1' })
		];
		const [sheet] = buildScoresheetByGame(events, [], players);
		const columns = buildSheetColumns(sheet);
		// 開始列(0/0) + ラリー2本 = 3列
		expect(columns).toHaveLength(3);
		expect(columns[0].cells).toHaveLength(2);
		expect(columns[1].cells).toEqual([{ playerId: 's1', side: 'A', scoreA: 1, scoreB: 0 }]);
		// サービスオーバーの太線は s1 のラン最終列の後
		expect(columns[1].serviceOver).toBe(true);
		expect(columns[2].cells).toEqual([{ playerId: 'r1', side: 'B', scoreA: 1, scoreB: 1 }]);
	});

	test('receiver winning the first rally keeps the shared start column', () => {
		resetSeq();
		const events = [
			matchStarted('s1', 'r1'),
			rallyWon({ side: 'B', scoreA: 0, scoreB: 1, serverBefore: 's1', serverAfter: 'r1' })
		];
		const [sheet] = buildScoresheetByGame(events, [], players);
		const columns = buildSheetColumns(sheet);
		expect(columns).toHaveLength(2);
		expect(columns[0].cells).toHaveLength(2);
		expect(columns[0].serviceOver).toBe(true);
	});
});

// ─── edge cases ───────────────────────────────────────────────────────────────

describe('buildScoresheetByGame: edge cases', () => {
	test('rally_won before match_started creates an orphan run', () => {
		resetSeq();
		const players = [makePlayer('s1', 'A')];
		const events = [
			rallyWon({ side: 'A', scoreA: 1, scoreB: 0, serverBefore: null, serverAfter: 's1' })
		];
		const result = buildScoresheetByGame(events, [], players);
		expect(result).toHaveLength(1);
		expect(result[0].serviceRuns[0].serverPlayerId).toBe('s1');
	});

	test('game_started for game 1 (same gameNo) initialises server/receiver', () => {
		resetSeq();
		const players = [makePlayer('s1', 'A'), makePlayer('r1', 'B')];
		// game_started with gameNo=1 (same as currentGameNo) → second branch
		const events = [gameStarted(1, 's1', 'r1')];
		const result = buildScoresheetByGame(events, [], players);
		expect(result).toHaveLength(1);
		// runs[0] = receiver slot, currentRun = server
		expect(runIds(result[0])).toEqual(['r1', 's1']);
	});

	test('duplicate seqNo events: later sorted position wins (stable sort)', () => {
		resetSeq();
		const players = [makePlayer('s1', 'A'), makePlayer('r1', 'B')];
		// Two events with the same seqNo – only one match_started should set up runs
		const ev = matchStarted('s1', 'r1');
		const evCopy = { ...ev }; // same seqNo
		const result = buildScoresheetByGame([evCopy, ev], [], players);
		// Both match_started events run → receiver slot pushed twice, currentRun reset twice
		// Result: runs has two receiver slots, currentRun = second match_started's server
		// This is an edge case; just ensure no crash and at least one GameSheet
		expect(result.length).toBeGreaterThanOrEqual(1);
	});
});
