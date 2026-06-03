import { describe, expect, test } from 'vitest';
import {
	applyDoublesServiceAfterRally,
	applyScoreEvent,
	createInitialDoublesServiceState,
	createInitialMatchState,
	isGameWon
} from './scoring';
import type { MatchPlayer, MatchState, ScoreEventInput } from './types';

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
