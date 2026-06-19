import { describe, expect, test } from 'vitest';
import {
	applyDoublesServiceAfterRally,
	applyScoreEvent,
	createInitialDoublesServiceState,
	createInitialMatchState,
	isGameWon,
	isMatchWon
} from './scoring';
import type { MatchPlayer, MatchState, ScoreEventInput, ScoringConfig, Side } from './types';

// Omit が discriminated union に対して非分配的であるため専用ユーティリティを定義する
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

const singlesPlayers: MatchPlayer[] = [
	{ id: 'a1', side: 'A', order: 1, name: 'A1' },
	{ id: 'b1', side: 'B', order: 1, name: 'B1' }
];

const doublesPlayers: MatchPlayer[] = [
	{ id: 'a1', side: 'A', order: 1, name: 'A1' },
	{ id: 'a2', side: 'A', order: 2, name: 'A2' },
	{ id: 'b1', side: 'B', order: 1, name: 'B1' },
	{ id: 'b2', side: 'B', order: 2, name: 'B2' }
];

describe('badminton scoring', () => {
	test('21-19 wins a game', () => {
		expect(
			isGameWon({ A: 21, B: 19 }, 'A', {
				maxGames: 3,
				gamesToWin: 2,
				pointsToWin: 21,
				winBy: 2,
				maxPoints: 30,
				midGameIntervalPoint: 11
			})
		).toBe(true);
	});

	test('21-20 does not win a game', () => {
		expect(
			isGameWon({ A: 21, B: 20 }, 'A', {
				maxGames: 3,
				gamesToWin: 2,
				pointsToWin: 21,
				winBy: 2,
				maxPoints: 30,
				midGameIntervalPoint: 11
			})
		).toBe(false);
	});

	test('30-29 wins a game', () => {
		expect(
			isGameWon({ A: 30, B: 29 }, 'A', {
				maxGames: 3,
				gamesToWin: 2,
				pointsToWin: 21,
				winBy: 2,
				maxPoints: 30,
				midGameIntervalPoint: 11
			})
		).toBe(true);
	});

	test('rally_won increments score and seqNo', () => {
		const initial = createInitialMatchState({
			matchId: 'match_1',
			tournamentId: 'tournament_1',
			courtId: null,
			discipline: 'MS',
			now: '2026-06-03T00:00:00.000Z'
		});

		const playing = applyScoreEvent({
			state: initial,
			players: singlesPlayers,
			now: '2026-06-03T00:00:01.000Z',
			input: {
				type: 'match_started',
				idempotencyKey: 'start_1',
				observedSeqNo: 0,
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			}
		});

		const next = applyScoreEvent({
			state: playing,
			players: singlesPlayers,
			now: '2026-06-03T00:00:02.000Z',
			input: {
				type: 'rally_won',
				side: 'A',
				idempotencyKey: 'rally_1',
				observedSeqNo: 1
			}
		});

		expect(next.games[0].score).toEqual({ A: 1, B: 0 });
		expect(next.lastSeqNo).toBe(2);
	});

	test('stale input is rejected', () => {
		const initial = createInitialMatchState({
			matchId: 'match_1',
			tournamentId: 'tournament_1',
			courtId: null,
			discipline: 'MS',
			now: '2026-06-03T00:00:00.000Z'
		});

		const playing = applyScoreEvent({
			state: initial,
			players: singlesPlayers,
			now: '2026-06-03T00:00:01.000Z',
			input: {
				type: 'match_started',
				idempotencyKey: 'start_1',
				observedSeqNo: 0,
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			}
		});

		expect(() =>
			applyScoreEvent({
				state: playing,
				players: singlesPlayers,
				now: '2026-06-03T00:00:02.000Z',
				input: {
					type: 'rally_won',
					side: 'A',
					idempotencyKey: 'rally_1',
					observedSeqNo: 0
				}
			})
		).toThrow('does not match');
	});

	test('doubles initial service places server and receiver on right courts', () => {
		const service = createInitialDoublesServiceState({
			players: doublesPlayers,
			initialServerPlayerId: 'a1',
			initialReceiverPlayerId: 'b1'
		});

		expect(service.servingSide).toBe('A');
		expect(service.serviceCourt).toBe('right');
		expect(service.serverPlayerId).toBe('a1');
		expect(service.receiverPlayerId).toBe('b1');
		expect(service.courtAssignments).toEqual({
			A: { right: 'a1', left: 'a2' },
			B: { right: 'b1', left: 'b2' }
		});
	});

	test('doubles serving side point swaps only serving pair', () => {
		const before = createInitialDoublesServiceState({
			players: doublesPlayers,
			initialServerPlayerId: 'a1',
			initialReceiverPlayerId: 'b1'
		});

		const after = applyDoublesServiceAfterRally({
			before,
			scoreAfter: { A: 1, B: 0 },
			rallyWinner: 'A'
		});

		expect(after.servingSide).toBe('A');
		expect(after.serviceCourt).toBe('left');
		expect(after.serverPlayerId).toBe('a1');
		expect(after.receiverPlayerId).toBe('b2');
		expect(after.courtAssignments).toEqual({
			A: { right: 'a2', left: 'a1' },
			B: { right: 'b1', left: 'b2' }
		});
	});

	test('doubles receiving side point keeps court assignments', () => {
		const before = createInitialDoublesServiceState({
			players: doublesPlayers,
			initialServerPlayerId: 'a1',
			initialReceiverPlayerId: 'b1'
		});

		const after = applyDoublesServiceAfterRally({
			before,
			scoreAfter: { A: 0, B: 1 },
			rallyWinner: 'B'
		});

		expect(after.servingSide).toBe('B');
		expect(after.serviceCourt).toBe('left');
		expect(after.serverPlayerId).toBe('b2');
		expect(after.receiverPlayerId).toBe('a2');
		expect(after.courtAssignments).toEqual(before.courtAssignments);
	});

	test('doubles continuous rally sequence follows service rules', () => {
		let state = createInitialMatchState({
			matchId: 'match_1',
			tournamentId: 'tournament_1',
			courtId: null,
			discipline: 'MD',
			now: '2026-06-03T00:00:00.000Z'
		});
		state = apply(state, {
			type: 'match_started',
			idempotencyKey: 'start',
			observedSeqNo: 0,
			initialServerPlayerId: 'a1',
			initialReceiverPlayerId: 'b1'
		});
		state = apply(state, {
			type: 'rally_won',
			idempotencyKey: 'rally_1',
			observedSeqNo: 1,
			side: 'A'
		});
		state = apply(state, {
			type: 'rally_won',
			idempotencyKey: 'rally_2',
			observedSeqNo: 2,
			side: 'B'
		});
		state = apply(state, {
			type: 'rally_won',
			idempotencyKey: 'rally_3',
			observedSeqNo: 3,
			side: 'B'
		});

		expect(state.games[0].score).toEqual({ A: 1, B: 2 });
		expect(state.service).toMatchObject({
			discipline: 'doubles',
			servingSide: 'B',
			serviceCourt: 'right',
			serverPlayerId: 'b2',
			receiverPlayerId: 'a2'
		});
	});

	test('correction updates current game score and service', () => {
		let state = createInitialMatchState({
			matchId: 'match_1',
			tournamentId: 'tournament_1',
			courtId: null,
			discipline: 'MS',
			now: '2026-06-03T00:00:00.000Z'
		});
		state = apply(state, {
			type: 'match_started',
			idempotencyKey: 'start',
			observedSeqNo: 0,
			initialServerPlayerId: 'a1',
			initialReceiverPlayerId: 'b1'
		});
		state = apply(state, {
			type: 'correction',
			idempotencyKey: 'correction',
			observedSeqNo: 1,
			gameNo: 1,
			score: { A: 10, B: 9 },
			service: {
				discipline: 'singles',
				servingSide: 'B',
				serviceCourt: 'left',
				serverPlayerId: 'b1',
				receiverPlayerId: 'a1'
			},
			reason: 'scoreboard mismatch'
		});

		expect(state.games[0].score).toEqual({ A: 10, B: 9 });
		expect(state.service).toMatchObject({ servingSide: 'B', serviceCourt: 'left' });
		expect(state.lastSeqNo).toBe(2);
	});

	test('undo restores target beforeState and advances seqNo', () => {
		const initial = createInitialMatchState({
			matchId: 'match_1',
			tournamentId: 'tournament_1',
			courtId: null,
			discipline: 'MS',
			now: '2026-06-03T00:00:00.000Z'
		});
		const playing = apply(initial, {
			type: 'match_started',
			idempotencyKey: 'start',
			observedSeqNo: 0,
			initialServerPlayerId: 'a1',
			initialReceiverPlayerId: 'b1'
		});
		const afterRally = apply(playing, {
			type: 'rally_won',
			idempotencyKey: 'rally_1',
			observedSeqNo: 1,
			side: 'A'
		});
		const undone = applyScoreEvent({
			state: afterRally,
			players: singlesPlayers,
			now: '2026-06-03T00:00:03.000Z',
			input: {
				type: 'undo',
				idempotencyKey: 'undo_1',
				observedSeqNo: 2,
				targetSeqNo: 2,
				restoreState: playing
			}
		});

		expect(undone.games[0].score).toEqual({ A: 0, B: 0 });
		expect(undone.status).toBe('playing');
		expect(undone.lastSeqNo).toBe(3);
	});
});

function apply(state: MatchState, input: ScoreEventInput): MatchState {
	return applyScoreEvent({
		state,
		players:
			state.discipline === 'MS' || state.discipline === 'WS' ? singlesPlayers : doublesPlayers,
		now: `2026-06-03T00:00:${String(input.observedSeqNo + 1).padStart(2, '0')}.000Z`,
		input
	});
}

// seqNoを自動で合わせるヘルパー（ラリー多数のテスト向け）
function step(
	state: MatchState,
	partial: DistributiveOmit<ScoreEventInput, 'observedSeqNo'>,
	players: MatchPlayer[]
): MatchState {
	return applyScoreEvent({
		state,
		players,
		now: '2026-06-03T00:00:00.000Z',
		input: { ...partial, observedSeqNo: state.lastSeqNo } as ScoreEventInput
	});
}

// 同じサイドが n ラリー連続で勝つ
function playRallies(state: MatchState, side: Side, n: number, players: MatchPlayer[]): MatchState {
	for (let i = 0; i < n; i++) {
		state = step(
			state,
			{ type: 'rally_won', side, idempotencyKey: `r${state.lastSeqNo}` },
			players
		);
	}
	return state;
}

// ─── isMatchWon ─────────────────────────────────────────────────────────────

describe('isMatchWon', () => {
	const bwf: ScoringConfig = {
		maxGames: 3,
		gamesToWin: 2,
		pointsToWin: 21,
		winBy: 2,
		maxPoints: 30,
		midGameIntervalPoint: 11
	};
	const tiebreaker: ScoringConfig = { ...bwf, maxGames: 1, gamesToWin: 1 };

	test('2 games won satisfies gamesToWin=2', () =>
		expect(isMatchWon({ A: 2, B: 0 }, 'A', bwf)).toBe(true));
	test('1 game won does not satisfy gamesToWin=2', () =>
		expect(isMatchWon({ A: 1, B: 0 }, 'A', bwf)).toBe(false));
	test('0 games won returns false', () => expect(isMatchWon({ A: 0, B: 0 }, 'A', bwf)).toBe(false));
	test('1 game won satisfies gamesToWin=1 (tiebreaker config)', () =>
		expect(isMatchWon({ A: 1, B: 0 }, 'A', tiebreaker)).toBe(true));
	test('B side: 2 games won returns true for B', () =>
		expect(isMatchWon({ A: 0, B: 2 }, 'B', bwf)).toBe(true));
	test('B side: 2 games won returns false for A', () =>
		expect(isMatchWon({ A: 0, B: 2 }, 'A', bwf)).toBe(false));
});

// ─── isGameWon: alternative scoring configs ──────────────────────────────────

describe('isGameWon with GROUP_15 scoring (pointsToWin=15, maxPoints=21)', () => {
	const group15: ScoringConfig = {
		maxGames: 3,
		gamesToWin: 2,
		pointsToWin: 15,
		winBy: 2,
		maxPoints: 21,
		midGameIntervalPoint: 8
	};

	test('15-13 wins', () => expect(isGameWon({ A: 15, B: 13 }, 'A', group15)).toBe(true));
	test('15-14 does not win (need 2-point lead)', () =>
		expect(isGameWon({ A: 15, B: 14 }, 'A', group15)).toBe(false));
	test('16-14 wins (above pointsToWin, 2-point lead)', () =>
		expect(isGameWon({ A: 16, B: 14 }, 'A', group15)).toBe(true));
	test('21-20 wins at maxPoints', () =>
		expect(isGameWon({ A: 21, B: 20 }, 'A', group15)).toBe(true));
	test('14-x never wins (below pointsToWin)', () =>
		expect(isGameWon({ A: 14, B: 0 }, 'A', group15)).toBe(false));
});

describe('isGameWon: deuce and maxPoints boundary', () => {
	const bwf: ScoringConfig = {
		maxGames: 3,
		gamesToWin: 2,
		pointsToWin: 21,
		winBy: 2,
		maxPoints: 30,
		midGameIntervalPoint: 11
	};

	test('29-29 neither side wins (both below maxPoints)', () => {
		expect(isGameWon({ A: 29, B: 29 }, 'A', bwf)).toBe(false);
		expect(isGameWon({ A: 29, B: 29 }, 'B', bwf)).toBe(false);
	});
	test('30-28 wins at maxPoints (no need for 2-point lead)', () =>
		expect(isGameWon({ A: 30, B: 28 }, 'A', bwf)).toBe(true));
	test('22-20 wins (2-point lead above pointsToWin)', () =>
		expect(isGameWon({ A: 22, B: 20 }, 'A', bwf)).toBe(true));
	test('21-21 neither side wins (no 2-point lead, not at maxPoints)', () => {
		expect(isGameWon({ A: 21, B: 21 }, 'A', bwf)).toBe(false);
		expect(isGameWon({ A: 21, B: 21 }, 'B', bwf)).toBe(false);
	});
});

// ─── match_started preconditions ────────────────────────────────────────────

describe('match_started preconditions', () => {
	test('throws when match is already playing', () => {
		const initial = createInitialMatchState({
			matchId: 'm',
			tournamentId: 't',
			courtId: null,
			discipline: 'MS',
			now: '2026-06-03T00:00:00.000Z'
		});
		const playing = step(
			initial,
			{
				type: 'match_started',
				idempotencyKey: 'start',
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			},
			singlesPlayers
		);
		expect(() =>
			step(
				playing,
				{
					type: 'match_started',
					idempotencyKey: 'start2',
					initialServerPlayerId: 'a1',
					initialReceiverPlayerId: 'b1'
				},
				singlesPlayers
			)
		).toThrow('scheduled');
	});
});

// ─── game_started preconditions ─────────────────────────────────────────────

describe('game_started preconditions', () => {
	function buildIntervalState() {
		let s = createInitialMatchState({
			matchId: 'm',
			tournamentId: 't',
			courtId: null,
			discipline: 'MS',
			now: '2026-06-03T00:00:00.000Z'
		});
		s = step(
			s,
			{
				type: 'match_started',
				idempotencyKey: 'start',
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			},
			singlesPlayers
		);
		return playRallies(s, 'A', 21, singlesPlayers);
	}

	test('throws when match is still playing (not interval)', () => {
		let s = createInitialMatchState({
			matchId: 'm',
			tournamentId: 't',
			courtId: null,
			discipline: 'MS',
			now: '2026-06-03T00:00:00.000Z'
		});
		s = step(
			s,
			{
				type: 'match_started',
				idempotencyKey: 'start',
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			},
			singlesPlayers
		);
		expect(() =>
			step(
				s,
				{
					type: 'game_started',
					idempotencyKey: 'g2',
					gameNo: 2,
					initialServerPlayerId: 'b1',
					initialReceiverPlayerId: 'a1'
				},
				singlesPlayers
			)
		).toThrow('interval');
	});

	test('throws when gameNo does not match currentGameNo', () => {
		const interval = buildIntervalState();
		expect(interval.status).toBe('interval');
		expect(interval.currentGameNo).toBe(2);

		expect(() =>
			step(
				interval,
				{
					type: 'game_started',
					idempotencyKey: 'g3',
					gameNo: 3, // wrong — should be 2
					initialServerPlayerId: 'b1',
					initialReceiverPlayerId: 'a1'
				},
				singlesPlayers
			)
		).toThrow('does not match');
	});

	test('succeeds when status is interval and gameNo matches', () => {
		const interval = buildIntervalState();
		const playing = step(
			interval,
			{
				type: 'game_started',
				idempotencyKey: 'g2',
				gameNo: 2,
				initialServerPlayerId: 'b1',
				initialReceiverPlayerId: 'a1'
			},
			singlesPlayers
		);
		expect(playing.status).toBe('playing');
		expect(playing.currentGameNo).toBe(2);
	});
});

// ─── let_called ─────────────────────────────────────────────────────────────

describe('let_called', () => {
	function buildPlayingState() {
		const s = createInitialMatchState({
			matchId: 'm',
			tournamentId: 't',
			courtId: null,
			discipline: 'MS',
			now: '2026-06-03T00:00:00.000Z'
		});
		return step(
			s,
			{
				type: 'match_started',
				idempotencyKey: 'start',
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			},
			singlesPlayers
		);
	}

	test('seqNo advances but score does not change', () => {
		const before = buildPlayingState();
		const after = step(
			before,
			{ type: 'let_called', idempotencyKey: 'let1', reason: 'receiver_not_ready' },
			singlesPlayers
		);
		expect(after.games[0].score).toEqual({ A: 0, B: 0 });
		expect(after.lastSeqNo).toBe(before.lastSeqNo + 1);
	});

	test('service state is unchanged after let', () => {
		const before = buildPlayingState();
		const after = step(
			before,
			{ type: 'let_called', idempotencyKey: 'let1', reason: 'shuttle_disintegrated' },
			singlesPlayers
		);
		expect(after.service).toEqual(before.service);
	});

	test('throws when match is not playing', () => {
		const initial = createInitialMatchState({
			matchId: 'm',
			tournamentId: 't',
			courtId: null,
			discipline: 'MS',
			now: '2026-06-03T00:00:00.000Z'
		});
		expect(() =>
			step(
				initial,
				{ type: 'let_called', idempotencyKey: 'let1', reason: 'receiver_not_ready' },
				singlesPlayers
			)
		).toThrow('playing');
	});
});

// ─── match_suspended / match_resumed ────────────────────────────────────────

describe('match_suspended and match_resumed', () => {
	function buildPlayingState() {
		const s = createInitialMatchState({
			matchId: 'm',
			tournamentId: 't',
			courtId: null,
			discipline: 'MS',
			now: '2026-06-03T00:00:00.000Z'
		});
		return step(
			s,
			{
				type: 'match_started',
				idempotencyKey: 'start',
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			},
			singlesPlayers
		);
	}

	test('match_suspended from playing → suspended', () => {
		const after = step(
			buildPlayingState(),
			{ type: 'match_suspended', idempotencyKey: 'sus1', reason: 'injury' },
			singlesPlayers
		);
		expect(after.status).toBe('suspended');
	});

	test('match_suspended from suspended throws', () => {
		const suspended = step(
			buildPlayingState(),
			{ type: 'match_suspended', idempotencyKey: 'sus1', reason: 'injury' },
			singlesPlayers
		);
		expect(() =>
			step(
				suspended,
				{ type: 'match_suspended', idempotencyKey: 'sus2', reason: 'injury' },
				singlesPlayers
			)
		).toThrow();
	});

	test('match_resumed from suspended → playing', () => {
		const suspended = step(
			buildPlayingState(),
			{ type: 'match_suspended', idempotencyKey: 'sus1', reason: 'injury' },
			singlesPlayers
		);
		const resumed = step(
			suspended,
			{ type: 'match_resumed', idempotencyKey: 'res1' },
			singlesPlayers
		);
		expect(resumed.status).toBe('playing');
	});

	test('match_resumed from playing throws', () => {
		expect(() =>
			step(buildPlayingState(), { type: 'match_resumed', idempotencyKey: 'res1' }, singlesPlayers)
		).toThrow('suspended');
	});

	test('score and service are preserved across suspend/resume', () => {
		let s = buildPlayingState();
		s = step(s, { type: 'rally_won', side: 'A', idempotencyKey: 'r1' }, singlesPlayers);
		const scoreBeforeSuspend = s.games[0].score;
		const serviceBeforeSuspend = s.service;

		s = step(
			s,
			{ type: 'match_suspended', idempotencyKey: 'sus', reason: 'injury' },
			singlesPlayers
		);
		s = step(s, { type: 'match_resumed', idempotencyKey: 'res' }, singlesPlayers);

		expect(s.games[0].score).toEqual(scoreBeforeSuspend);
		expect(s.service).toEqual(serviceBeforeSuspend);
	});
});

// ─── side_forfeited / side_retired ──────────────────────────────────────────

describe('side_forfeited and side_retired', () => {
	function buildPlayingState() {
		const s = createInitialMatchState({
			matchId: 'm',
			tournamentId: 't',
			courtId: null,
			discipline: 'MS',
			now: '2026-06-03T00:00:00.000Z'
		});
		return step(
			s,
			{
				type: 'match_started',
				idempotencyKey: 'start',
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			},
			singlesPlayers
		);
	}

	test('side_forfeited: status becomes forfeited, winner is other side', () => {
		const after = step(
			buildPlayingState(),
			{ type: 'side_forfeited', idempotencyKey: 'forf', side: 'A', reason: 'no_show' },
			singlesPlayers
		);
		expect(after.status).toBe('forfeited');
		expect(after.winnerSide).toBe('B');
		expect(after.terminalReason).toBe('forfeit');
		expect(after.service).toBeNull();
	});

	test('side_forfeited: forfeiting B gives win to A', () => {
		const after = step(
			buildPlayingState(),
			{ type: 'side_forfeited', idempotencyKey: 'forf', side: 'B', reason: 'withdrawal' },
			singlesPlayers
		);
		expect(after.winnerSide).toBe('A');
	});

	test('side_retired: status becomes retired, winner is other side', () => {
		const after = step(
			buildPlayingState(),
			{ type: 'side_retired', idempotencyKey: 'ret', side: 'A', reason: 'injury' },
			singlesPlayers
		);
		expect(after.status).toBe('retired');
		expect(after.winnerSide).toBe('B');
		expect(after.terminalReason).toBe('retirement');
		expect(after.service).toBeNull();
	});
});

// ─── match_confirmed ────────────────────────────────────────────────────────

describe('match_confirmed', () => {
	function buildState(status: 'finished' | 'forfeited' | 'retired'): MatchState {
		let s = createInitialMatchState({
			matchId: 'm',
			tournamentId: 't',
			courtId: null,
			discipline: 'MS',
			now: '2026-06-03T00:00:00.000Z'
		});
		s = step(
			s,
			{
				type: 'match_started',
				idempotencyKey: 'start',
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			},
			singlesPlayers
		);
		if (status === 'finished') {
			s = playRallies(s, 'A', 21, singlesPlayers);
			s = step(
				s,
				{
					type: 'game_started',
					idempotencyKey: 'g2',
					gameNo: 2,
					initialServerPlayerId: 'b1',
					initialReceiverPlayerId: 'a1'
				},
				singlesPlayers
			);
			s = playRallies(s, 'A', 21, singlesPlayers);
		} else if (status === 'forfeited') {
			s = step(
				s,
				{ type: 'side_forfeited', idempotencyKey: 'forf', side: 'B', reason: 'no_show' },
				singlesPlayers
			);
		} else {
			s = step(
				s,
				{ type: 'side_retired', idempotencyKey: 'ret', side: 'B', reason: 'injury' },
				singlesPlayers
			);
		}
		return s;
	}

	test('confirmed from finished → confirmed', () => {
		const finished = buildState('finished');
		expect(finished.status).toBe('finished');
		const confirmed = step(
			finished,
			{ type: 'match_confirmed', idempotencyKey: 'conf' },
			singlesPlayers
		);
		expect(confirmed.status).toBe('confirmed');
		expect(confirmed.winnerSide).toBe('A');
	});

	test('confirmed from forfeited → confirmed', () => {
		const after = step(
			buildState('forfeited'),
			{ type: 'match_confirmed', idempotencyKey: 'conf' },
			singlesPlayers
		);
		expect(after.status).toBe('confirmed');
	});

	test('confirmed from retired → confirmed', () => {
		const after = step(
			buildState('retired'),
			{ type: 'match_confirmed', idempotencyKey: 'conf' },
			singlesPlayers
		);
		expect(after.status).toBe('confirmed');
	});

	test('confirmed from playing throws', () => {
		let s = createInitialMatchState({
			matchId: 'm',
			tournamentId: 't',
			courtId: null,
			discipline: 'MS',
			now: '2026-06-03T00:00:00.000Z'
		});
		s = step(
			s,
			{
				type: 'match_started',
				idempotencyKey: 'start',
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			},
			singlesPlayers
		);
		expect(() =>
			step(s, { type: 'match_confirmed', idempotencyKey: 'conf' }, singlesPlayers)
		).toThrow();
	});
});

// ─── game completion → interval ─────────────────────────────────────────────

describe('game completion transitions to interval', () => {
	function buildAfterGame1(): MatchState {
		let s = createInitialMatchState({
			matchId: 'm',
			tournamentId: 't',
			courtId: null,
			discipline: 'MS',
			now: '2026-06-03T00:00:00.000Z'
		});
		s = step(
			s,
			{
				type: 'match_started',
				idempotencyKey: 'start',
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			},
			singlesPlayers
		);
		return playRallies(s, 'A', 21, singlesPlayers);
	}

	test('winning game 1 transitions to interval', () => {
		const s = buildAfterGame1();
		expect(s.status).toBe('interval');
	});

	test('currentGameNo advances to 2', () => {
		expect(buildAfterGame1().currentGameNo).toBe(2);
	});

	test('game 1 score is preserved in games array', () => {
		const s = buildAfterGame1();
		const game1 = s.games.find((g) => g.gameNo === 1)!;
		expect(game1.score).toEqual({ A: 21, B: 0 });
		expect(game1.winnerSide).toBe('A');
	});

	test('game 2 is added with 0-0 score', () => {
		const s = buildAfterGame1();
		const game2 = s.games.find((g) => g.gameNo === 2)!;
		expect(game2).toBeDefined();
		expect(game2.score).toEqual({ A: 0, B: 0 });
		expect(game2.winnerSide).toBeNull();
	});

	test('gamesWon increments correctly', () => {
		expect(buildAfterGame1().gamesWon).toEqual({ A: 1, B: 0 });
	});

	test('service is cleared at interval', () => {
		expect(buildAfterGame1().service).toBeNull();
	});
});

// ─── match completion → finished ─────────────────────────────────────────────

describe('match completion transitions to finished', () => {
	function buildFinishedMatch(): MatchState {
		let s = createInitialMatchState({
			matchId: 'm',
			tournamentId: 't',
			courtId: null,
			discipline: 'MS',
			now: '2026-06-03T00:00:00.000Z'
		});
		s = step(
			s,
			{
				type: 'match_started',
				idempotencyKey: 'start',
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			},
			singlesPlayers
		);
		s = playRallies(s, 'A', 21, singlesPlayers);
		s = step(
			s,
			{
				type: 'game_started',
				idempotencyKey: 'g2',
				gameNo: 2,
				initialServerPlayerId: 'b1',
				initialReceiverPlayerId: 'a1'
			},
			singlesPlayers
		);
		return playRallies(s, 'A', 21, singlesPlayers);
	}

	test('winning second game finishes the match', () =>
		expect(buildFinishedMatch().status).toBe('finished'));
	test('winnerSide is set correctly', () => expect(buildFinishedMatch().winnerSide).toBe('A'));
	test('terminalReason is normal', () =>
		expect(buildFinishedMatch().terminalReason).toBe('normal'));
	test('service is cleared', () => expect(buildFinishedMatch().service).toBeNull());
	test('gamesWon is 2-0', () => expect(buildFinishedMatch().gamesWon).toEqual({ A: 2, B: 0 }));
});

// ─── 3-game match integration ────────────────────────────────────────────────

describe('3-game match: A wins G1, B wins G2, A wins G3', () => {
	function buildThreeGameMatch(): MatchState {
		let s = createInitialMatchState({
			matchId: 'm',
			tournamentId: 't',
			courtId: null,
			discipline: 'MS',
			now: '2026-06-03T00:00:00.000Z'
		});
		s = step(
			s,
			{
				type: 'match_started',
				idempotencyKey: 'start',
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			},
			singlesPlayers
		);
		// Game 1: A wins 21-0
		s = playRallies(s, 'A', 21, singlesPlayers);

		// Game 2: B wins 21-0
		s = step(
			s,
			{
				type: 'game_started',
				idempotencyKey: 'g2',
				gameNo: 2,
				initialServerPlayerId: 'b1',
				initialReceiverPlayerId: 'a1'
			},
			singlesPlayers
		);
		s = playRallies(s, 'B', 21, singlesPlayers);

		// Game 3: A wins 21-0
		s = step(
			s,
			{
				type: 'game_started',
				idempotencyKey: 'g3',
				gameNo: 3,
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			},
			singlesPlayers
		);
		s = playRallies(s, 'A', 21, singlesPlayers);
		return s;
	}

	test('match finishes', () => expect(buildThreeGameMatch().status).toBe('finished'));
	test('A wins the match', () => expect(buildThreeGameMatch().winnerSide).toBe('A'));
	test('gamesWon is 2-1', () => expect(buildThreeGameMatch().gamesWon).toEqual({ A: 2, B: 1 }));
	test('three games are recorded', () => expect(buildThreeGameMatch().games).toHaveLength(3));
	test('game 3 score is correct', () => {
		const s = buildThreeGameMatch();
		const g3 = s.games.find((g) => g.gameNo === 3)!;
		expect(g3.score).toEqual({ A: 21, B: 0 });
		expect(g3.winnerSide).toBe('A');
	});
});

// ─── mid-game interval flag ──────────────────────────────────────────────────

describe('mid-game interval and change-ends flags', () => {
	function buildToScore(a: number, b: number): MatchState {
		let s = createInitialMatchState({
			matchId: 'm',
			tournamentId: 't',
			courtId: null,
			discipline: 'MS',
			now: '2026-06-03T00:00:00.000Z'
		});
		s = step(
			s,
			{
				type: 'match_started',
				idempotencyKey: 'start',
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			},
			singlesPlayers
		);
		s = playRallies(s, 'A', a, singlesPlayers);
		s = playRallies(s, 'B', b, singlesPlayers);
		return s;
	}

	test('midGameIntervalTaken false before reaching 11 points', () => {
		const s = buildToScore(10, 0);
		expect(s.games[0].midGameIntervalTaken).toBe(false);
	});

	test('midGameIntervalTaken set when A reaches 11', () => {
		const s = buildToScore(11, 0);
		expect(s.games[0].midGameIntervalTaken).toBe(true);
	});

	test('midGameIntervalTaken set when B reaches 11', () => {
		const s = buildToScore(0, 11);
		expect(s.games[0].midGameIntervalTaken).toBe(true);
	});

	test('midGameIntervalTaken stays true after the interval point passes', () => {
		const s = buildToScore(15, 0);
		expect(s.games[0].midGameIntervalTaken).toBe(true);
	});

	test('changeEndsRequired not set in game 1', () => {
		const s = buildToScore(11, 0);
		expect(s.games[0].changeEndsRequired).toBe(false);
	});

	test('changeEndsRequired set in final game (game 3) when reaching 11', () => {
		// Bring match to game 3 first
		let s = buildToScore(21, 0); // A wins game 1
		s = step(
			s,
			{
				type: 'game_started',
				idempotencyKey: 'g2',
				gameNo: 2,
				initialServerPlayerId: 'b1',
				initialReceiverPlayerId: 'a1'
			},
			singlesPlayers
		);
		s = playRallies(s, 'B', 21, singlesPlayers); // B wins game 2
		s = step(
			s,
			{
				type: 'game_started',
				idempotencyKey: 'g3',
				gameNo: 3,
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			},
			singlesPlayers
		);
		s = playRallies(s, 'A', 11, singlesPlayers); // A reaches 11 in game 3
		const g3 = s.games.find((g) => g.gameNo === 3)!;
		expect(g3.changeEndsRequired).toBe(true);
	});
});

// ─── correction validation ───────────────────────────────────────────────────

describe('correction validation', () => {
	function buildPlayingState() {
		const s = createInitialMatchState({
			matchId: 'm',
			tournamentId: 't',
			courtId: null,
			discipline: 'MS',
			now: '2026-06-03T00:00:00.000Z'
		});
		return step(
			s,
			{
				type: 'match_started',
				idempotencyKey: 'start',
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			},
			singlesPlayers
		);
	}

	test('throws for negative score A', () => {
		expect(() =>
			step(
				buildPlayingState(),
				{
					type: 'correction',
					idempotencyKey: 'c1',
					gameNo: 1,
					score: { A: -1, B: 0 },
					reason: 'test'
				},
				singlesPlayers
			)
		).toThrow('non-negative');
	});

	test('throws for negative score B', () => {
		expect(() =>
			step(
				buildPlayingState(),
				{
					type: 'correction',
					idempotencyKey: 'c1',
					gameNo: 1,
					score: { A: 0, B: -1 },
					reason: 'test'
				},
				singlesPlayers
			)
		).toThrow('non-negative');
	});

	test('throws when score exceeds maxPoints (30)', () => {
		expect(() =>
			step(
				buildPlayingState(),
				{
					type: 'correction',
					idempotencyKey: 'c1',
					gameNo: 1,
					score: { A: 31, B: 0 },
					reason: 'test'
				},
				singlesPlayers
			)
		).toThrow('maxPoints');
	});

	test('throws when gameNo does not match currentGameNo', () => {
		expect(() =>
			step(
				buildPlayingState(),
				{
					type: 'correction',
					idempotencyKey: 'c1',
					gameNo: 2,
					score: { A: 5, B: 3 },
					reason: 'test'
				},
				singlesPlayers
			)
		).toThrow('current game');
	});

	test('applies valid correction and updates score', () => {
		const after = step(
			buildPlayingState(),
			{
				type: 'correction',
				idempotencyKey: 'c1',
				gameNo: 1,
				score: { A: 10, B: 9 },
				reason: 'scoreboard mismatch'
			},
			singlesPlayers
		);
		expect(after.games[0].score).toEqual({ A: 10, B: 9 });
	});

	test('correction with gamesWon override updates gamesWon', () => {
		const after = step(
			buildPlayingState(),
			{
				type: 'correction',
				idempotencyKey: 'c1',
				gameNo: 1,
				score: { A: 5, B: 3 },
				gamesWon: { A: 1, B: 0 },
				reason: 'test'
			},
			singlesPlayers
		);
		expect(after.gamesWon).toEqual({ A: 1, B: 0 });
	});

	test('correction with null service clears service', () => {
		const after = step(
			buildPlayingState(),
			{
				type: 'correction',
				idempotencyKey: 'c1',
				gameNo: 1,
				score: { A: 5, B: 3 },
				service: null,
				reason: 'test'
			},
			singlesPlayers
		);
		expect(after.service).toBeNull();
	});
});

// ─── singles service transitions within scoring ───────────────────────────────

describe('singles service transitions through applyScoreEvent', () => {
	function buildPlayingState() {
		const s = createInitialMatchState({
			matchId: 'm',
			tournamentId: 't',
			courtId: null,
			discipline: 'MS',
			now: '2026-06-03T00:00:00.000Z'
		});
		return step(
			s,
			{
				type: 'match_started',
				idempotencyKey: 'start',
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			},
			singlesPlayers
		);
	}

	test('A wins rally: A stays server, court moves to left', () => {
		const after = step(
			buildPlayingState(),
			{ type: 'rally_won', side: 'A', idempotencyKey: 'r1' },
			singlesPlayers
		);
		expect(after.service?.servingSide).toBe('A');
		expect(after.service?.serviceCourt).toBe('left');
		expect(after.service?.serverPlayerId).toBe('a1');
	});

	test('B wins rally: service transfers to B, B on left court (score 1)', () => {
		const after = step(
			buildPlayingState(),
			{ type: 'rally_won', side: 'B', idempotencyKey: 'r1' },
			singlesPlayers
		);
		expect(after.service?.servingSide).toBe('B');
		expect(after.service?.serviceCourt).toBe('left'); // B score=1 → odd → left
		expect(after.service?.serverPlayerId).toBe('b1');
		expect(after.service?.receiverPlayerId).toBe('a1');
	});

	test('two A wins then one B win: service transfers to B, court reflects B score 1', () => {
		let s = buildPlayingState();
		s = step(s, { type: 'rally_won', side: 'A', idempotencyKey: 'r1' }, singlesPlayers);
		s = step(s, { type: 'rally_won', side: 'A', idempotencyKey: 'r2' }, singlesPlayers);
		s = step(s, { type: 'rally_won', side: 'B', idempotencyKey: 'r3' }, singlesPlayers);
		expect(s.service?.servingSide).toBe('B');
		expect(s.service?.serviceCourt).toBe('left'); // B score=1 → odd → left
	});
});

// ─── match_unconfirmed ──────────────────────────────────────────────────────

describe('match_unconfirmed', () => {
	function buildConfirmedState(): MatchState {
		let s = createInitialMatchState({
			matchId: 'm',
			tournamentId: 't',
			courtId: null,
			discipline: 'MS',
			now: '2026-06-03T00:00:00.000Z'
		});
		s = step(
			s,
			{
				type: 'match_started',
				idempotencyKey: 'start',
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			},
			singlesPlayers
		);
		s = playRallies(s, 'A', 21, singlesPlayers);
		s = step(
			s,
			{
				type: 'game_started',
				idempotencyKey: 'g2',
				gameNo: 2,
				initialServerPlayerId: 'b1',
				initialReceiverPlayerId: 'a1'
			},
			singlesPlayers
		);
		s = playRallies(s, 'A', 21, singlesPlayers);
		s = step(s, { type: 'match_confirmed', idempotencyKey: 'conf' }, singlesPlayers);
		return s;
	}

	test('match_unconfirmed from confirmed restores finished status', () => {
		const confirmed = buildConfirmedState();
		expect(confirmed.status).toBe('confirmed');
		expect(confirmed.confirmedFromStatus).toBe('finished');
		const unconfirmed = step(
			confirmed,
			{ type: 'match_unconfirmed', idempotencyKey: 'unconf' },
			singlesPlayers
		);
		expect(unconfirmed.status).toBe('finished');
		expect(unconfirmed.confirmedFromStatus).toBeNull();
	});

	test('match_unconfirmed from non-confirmed throws', () => {
		let s = createInitialMatchState({
			matchId: 'm',
			tournamentId: 't',
			courtId: null,
			discipline: 'MS',
			now: '2026-06-03T00:00:00.000Z'
		});
		s = step(
			s,
			{
				type: 'match_started',
				idempotencyKey: 'start',
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			},
			singlesPlayers
		);
		expect(() =>
			step(s, { type: 'match_unconfirmed', idempotencyKey: 'unconf' }, singlesPlayers)
		).toThrow('confirmed');
	});

	test('confirmedFromStatus is set to previous status on confirm', () => {
		const s = buildConfirmedState();
		expect(s.confirmedFromStatus).toBe('finished');
	});
});

// ─── confirmed match locking ────────────────────────────────────────────────

describe('confirmed match rejects mutations', () => {
	function buildConfirmed(): MatchState {
		let s = createInitialMatchState({
			matchId: 'm',
			tournamentId: 't',
			courtId: null,
			discipline: 'MS',
			now: '2026-06-03T00:00:00.000Z'
		});
		s = step(
			s,
			{
				type: 'match_started',
				idempotencyKey: 'start',
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			},
			singlesPlayers
		);
		s = playRallies(s, 'A', 21, singlesPlayers);
		s = step(
			s,
			{
				type: 'game_started',
				idempotencyKey: 'g2',
				gameNo: 2,
				initialServerPlayerId: 'b1',
				initialReceiverPlayerId: 'a1'
			},
			singlesPlayers
		);
		s = playRallies(s, 'A', 21, singlesPlayers);
		return step(s, { type: 'match_confirmed', idempotencyKey: 'conf' }, singlesPlayers);
	}

	test('rally_won is rejected when confirmed', () => {
		const s = buildConfirmed();
		expect(() =>
			step(s, { type: 'rally_won', side: 'A', idempotencyKey: 'r' }, singlesPlayers)
		).toThrow('承認済み');
	});

	test('correction is rejected when confirmed', () => {
		const s = buildConfirmed();
		expect(() =>
			step(
				s,
				{
					type: 'correction',
					idempotencyKey: 'corr',
					gameNo: 1,
					score: { A: 0, B: 0 },
					reason: 'test'
				},
				singlesPlayers
			)
		).toThrow('承認済み');
	});

	test('suspend is rejected when confirmed', () => {
		const s = buildConfirmed();
		expect(() =>
			step(s, { type: 'match_suspended', idempotencyKey: 'sus', reason: 'injury' }, singlesPlayers)
		).toThrow('承認済み');
	});

	test('forfeit is rejected when confirmed', () => {
		const s = buildConfirmed();
		expect(() =>
			step(
				s,
				{
					type: 'side_forfeited',
					idempotencyKey: 'forf',
					side: 'A',
					reason: 'no_show'
				},
				singlesPlayers
			)
		).toThrow('承認済み');
	});

	test('undo is rejected when confirmed', () => {
		const s = buildConfirmed();
		expect(() =>
			applyScoreEvent({
				state: s,
				players: singlesPlayers,
				now: '2026-06-03T00:00:10.000Z',
				input: {
					type: 'undo',
					idempotencyKey: 'undo_confirmed',
					observedSeqNo: s.lastSeqNo,
					restoreState: s
				}
			})
		).toThrow('承認済み');
	});
});
