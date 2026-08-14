import { describe, expect, test } from 'vitest';
import {
	otherSide,
	otherCourt,
	serviceCourtForScore,
	scoreOfSide,
	playerOnCourt,
	swapCourtsForSide,
	sideOfPlayer,
	validateDoublesPlayers,
	createInitialSinglesServiceState,
	createInitialDoublesServiceState,
	applySinglesServiceAfterRally,
	applyDoublesServiceAfterRally
} from './service';
import type { CourtAssignments, MatchPlayer } from './types';

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

// ─── otherSide ──────────────────────────────────────────────────────────────

describe('otherSide', () => {
	test('A → B', () => expect(otherSide('A')).toBe('B'));
	test('B → A', () => expect(otherSide('B')).toBe('A'));
});

// ─── otherCourt ─────────────────────────────────────────────────────────────

describe('otherCourt', () => {
	test('right → left', () => expect(otherCourt('right')).toBe('left'));
	test('left → right', () => expect(otherCourt('left')).toBe('right'));
});

// ─── serviceCourtForScore ───────────────────────────────────────────────────

describe('serviceCourtForScore', () => {
	test('score 0 → right (even)', () => expect(serviceCourtForScore(0)).toBe('right'));
	test('score 1 → left (odd)', () => expect(serviceCourtForScore(1)).toBe('left'));
	test('score 2 → right (even)', () => expect(serviceCourtForScore(2)).toBe('right'));
	test('score 11 → left (odd)', () => expect(serviceCourtForScore(11)).toBe('left'));
	test('score 20 → right (even)', () => expect(serviceCourtForScore(20)).toBe('right'));
	test('score 21 → left (odd)', () => expect(serviceCourtForScore(21)).toBe('left'));
});

// ─── scoreOfSide ────────────────────────────────────────────────────────────

describe('scoreOfSide', () => {
	test('returns A value when side is A', () => expect(scoreOfSide({ A: 15, B: 7 }, 'A')).toBe(15));
	test('returns B value when side is B', () => expect(scoreOfSide({ A: 15, B: 7 }, 'B')).toBe(7));
	test('handles zero scores', () => {
		expect(scoreOfSide({ A: 0, B: 0 }, 'A')).toBe(0);
		expect(scoreOfSide({ A: 0, B: 0 }, 'B')).toBe(0);
	});
});

// ─── playerOnCourt ──────────────────────────────────────────────────────────

describe('playerOnCourt', () => {
	const assignments: CourtAssignments = {
		A: { right: 'a1', left: 'a2' },
		B: { right: 'b1', left: 'b2' }
	};

	test('A right', () => expect(playerOnCourt(assignments, 'A', 'right')).toBe('a1'));
	test('A left', () => expect(playerOnCourt(assignments, 'A', 'left')).toBe('a2'));
	test('B right', () => expect(playerOnCourt(assignments, 'B', 'right')).toBe('b1'));
	test('B left', () => expect(playerOnCourt(assignments, 'B', 'left')).toBe('b2'));
});

// ─── swapCourtsForSide ──────────────────────────────────────────────────────

describe('swapCourtsForSide', () => {
	const original: CourtAssignments = {
		A: { right: 'a1', left: 'a2' },
		B: { right: 'b1', left: 'b2' }
	};

	test('swaps A courts and leaves B unchanged', () => {
		const result = swapCourtsForSide(original, 'A');
		expect(result.A).toEqual({ right: 'a2', left: 'a1' });
		expect(result.B).toEqual({ right: 'b1', left: 'b2' });
	});

	test('swaps B courts and leaves A unchanged', () => {
		const result = swapCourtsForSide(original, 'B');
		expect(result.A).toEqual({ right: 'a1', left: 'a2' });
		expect(result.B).toEqual({ right: 'b2', left: 'b1' });
	});

	test('double-swap restores original assignment', () => {
		const twice = swapCourtsForSide(swapCourtsForSide(original, 'A'), 'A');
		expect(twice).toEqual(original);
	});

	test('does not mutate the original object', () => {
		swapCourtsForSide(original, 'A');
		expect(original.A).toEqual({ right: 'a1', left: 'a2' });
	});
});

// ─── sideOfPlayer ───────────────────────────────────────────────────────────

describe('sideOfPlayer', () => {
	test('returns A for side-A player', () => expect(sideOfPlayer(doublesPlayers, 'a1')).toBe('A'));
	test('returns A for second side-A player', () =>
		expect(sideOfPlayer(doublesPlayers, 'a2')).toBe('A'));
	test('returns B for side-B player', () => expect(sideOfPlayer(doublesPlayers, 'b1')).toBe('B'));
	test('returns B for second side-B player', () =>
		expect(sideOfPlayer(doublesPlayers, 'b2')).toBe('B'));
	test('throws when player id is not found', () =>
		expect(() => sideOfPlayer(doublesPlayers, 'x99')).toThrow('Player not found: x99'));
});

// ─── validateDoublesPlayers ─────────────────────────────────────────────────

describe('validateDoublesPlayers', () => {
	test('accepts exactly two players per side', () =>
		expect(() => validateDoublesPlayers(doublesPlayers)).not.toThrow());

	test('throws when side A has only one player', () => {
		const players: MatchPlayer[] = [
			{ id: 'a1', side: 'A', order: 1, name: 'A1' },
			{ id: 'b1', side: 'B', order: 1, name: 'B1' },
			{ id: 'b2', side: 'B', order: 2, name: 'B2' }
		];
		expect(() => validateDoublesPlayers(players)).toThrow('exactly two players on side A');
	});

	test('throws when side B has only one player', () => {
		const players: MatchPlayer[] = [
			{ id: 'a1', side: 'A', order: 1, name: 'A1' },
			{ id: 'a2', side: 'A', order: 2, name: 'A2' },
			{ id: 'b1', side: 'B', order: 1, name: 'B1' }
		];
		expect(() => validateDoublesPlayers(players)).toThrow('exactly two players on side B');
	});

	test('throws when side A has three players', () => {
		const players: MatchPlayer[] = [
			{ id: 'a1', side: 'A', order: 1, name: 'A1' },
			{ id: 'a2', side: 'A', order: 2, name: 'A2' },
			{ id: 'a3', side: 'A', order: 2, name: 'A3' },
			{ id: 'b1', side: 'B', order: 1, name: 'B1' },
			{ id: 'b2', side: 'B', order: 2, name: 'B2' }
		];
		expect(() => validateDoublesPlayers(players)).toThrow('exactly two players on side A');
	});
});

// ─── createInitialSinglesServiceState ───────────────────────────────────────

describe('createInitialSinglesServiceState', () => {
	test('sets serving side from the server player', () => {
		const state = createInitialSinglesServiceState({
			players: singlesPlayers,
			initialServerPlayerId: 'a1',
			initialReceiverPlayerId: 'b1'
		});
		expect(state.discipline).toBe('singles');
		expect(state.servingSide).toBe('A');
		expect(state.serviceCourt).toBe('right');
		expect(state.serverPlayerId).toBe('a1');
		expect(state.receiverPlayerId).toBe('b1');
	});

	test('works when B side serves first', () => {
		const state = createInitialSinglesServiceState({
			players: singlesPlayers,
			initialServerPlayerId: 'b1',
			initialReceiverPlayerId: 'a1'
		});
		expect(state.servingSide).toBe('B');
		expect(state.serverPlayerId).toBe('b1');
		expect(state.receiverPlayerId).toBe('a1');
	});

	test('always starts on the right service court', () => {
		const state = createInitialSinglesServiceState({
			players: singlesPlayers,
			initialServerPlayerId: 'a1',
			initialReceiverPlayerId: 'b1'
		});
		expect(state.serviceCourt).toBe('right');
	});

	test('throws when server and receiver are on the same side', () => {
		expect(() =>
			createInitialSinglesServiceState({
				players: doublesPlayers,
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'a2'
			})
		).toThrow('opposite side');
	});
});

// ─── createInitialDoublesServiceState ───────────────────────────────────────

describe('createInitialDoublesServiceState', () => {
	test('A1 serves to B1: initial court assignments', () => {
		const state = createInitialDoublesServiceState({
			players: doublesPlayers,
			initialServerPlayerId: 'a1',
			initialReceiverPlayerId: 'b1'
		});
		expect(state.discipline).toBe('doubles');
		expect(state.servingSide).toBe('A');
		expect(state.serviceCourt).toBe('right');
		expect(state.serverPlayerId).toBe('a1');
		expect(state.receiverPlayerId).toBe('b1');
		expect(state.courtAssignments).toEqual({
			A: { right: 'a1', left: 'a2' },
			B: { right: 'b1', left: 'b2' }
		});
	});

	test('B1 serves to A1: B is on right court', () => {
		const state = createInitialDoublesServiceState({
			players: doublesPlayers,
			initialServerPlayerId: 'b1',
			initialReceiverPlayerId: 'a1'
		});
		expect(state.servingSide).toBe('B');
		expect(state.serverPlayerId).toBe('b1');
		expect(state.receiverPlayerId).toBe('a1');
		expect(state.courtAssignments).toEqual({
			A: { right: 'a1', left: 'a2' },
			B: { right: 'b1', left: 'b2' }
		});
	});

	test('preserves initialServerPlayerId and initialReceiverPlayerId', () => {
		const state = createInitialDoublesServiceState({
			players: doublesPlayers,
			initialServerPlayerId: 'a1',
			initialReceiverPlayerId: 'b1'
		});
		expect(state.initialServerPlayerId).toBe('a1');
		expect(state.initialReceiverPlayerId).toBe('b1');
	});

	test('throws when server and receiver are on the same side', () => {
		expect(() =>
			createInitialDoublesServiceState({
				players: doublesPlayers,
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'a2'
			})
		).toThrow('receiving side');
	});

	test('throws when side A does not have exactly two players', () => {
		const players: MatchPlayer[] = [
			{ id: 'a1', side: 'A', order: 1, name: 'A1' },
			{ id: 'b1', side: 'B', order: 1, name: 'B1' },
			{ id: 'b2', side: 'B', order: 2, name: 'B2' }
		];
		expect(() =>
			createInitialDoublesServiceState({
				players,
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			})
		).toThrow('exactly two players on side A');
	});

	test('throws when partners cannot be identified', () => {
		const players: MatchPlayer[] = [
			{ id: 'a1', side: 'A', order: 1, name: 'A1' },
			{ id: 'a1', side: 'A', order: 2, name: 'A1 dup' },
			{ id: 'b1', side: 'B', order: 1, name: 'B1' },
			{ id: 'b2', side: 'B', order: 2, name: 'B2' }
		];
		expect(() =>
			createInitialDoublesServiceState({
				players,
				initialServerPlayerId: 'a1',
				initialReceiverPlayerId: 'b1'
			})
		).toThrow('Invalid doubles pair');
	});
});

// ─── applySinglesServiceAfterRally ──────────────────────────────────────────

describe('applySinglesServiceAfterRally', () => {
	const initialState = createInitialSinglesServiceState({
		players: singlesPlayers,
		initialServerPlayerId: 'a1',
		initialReceiverPlayerId: 'b1'
	});

	test('server (A) wins: stays on A, court moves to left at score 1', () => {
		const after = applySinglesServiceAfterRally({
			before: initialState,
			scoreAfter: { A: 1, B: 0 },
			rallyWinner: 'A',
			players: singlesPlayers
		});
		expect(after.servingSide).toBe('A');
		expect(after.serviceCourt).toBe('left'); // 1 → odd → left
		expect(after.serverPlayerId).toBe('a1');
		expect(after.receiverPlayerId).toBe('b1');
	});

	test('server (A) wins: court returns to right at score 2', () => {
		const after = applySinglesServiceAfterRally({
			before: { ...initialState, serviceCourt: 'left' },
			scoreAfter: { A: 2, B: 0 },
			rallyWinner: 'A',
			players: singlesPlayers
		});
		expect(after.serviceCourt).toBe('right'); // 2 → even → right
	});

	test('receiver (B) wins: service transfers to B', () => {
		const after = applySinglesServiceAfterRally({
			before: initialState,
			scoreAfter: { A: 0, B: 1 },
			rallyWinner: 'B',
			players: singlesPlayers
		});
		expect(after.servingSide).toBe('B');
		expect(after.serviceCourt).toBe('left'); // B score 1 → left
		expect(after.serverPlayerId).toBe('b1');
		expect(after.receiverPlayerId).toBe('a1');
	});

	test('receiver (A) wins when B is serving: service transfers back to A', () => {
		const bServing = createInitialSinglesServiceState({
			players: singlesPlayers,
			initialServerPlayerId: 'b1',
			initialReceiverPlayerId: 'a1'
		});
		const after = applySinglesServiceAfterRally({
			before: bServing,
			scoreAfter: { A: 1, B: 0 },
			rallyWinner: 'A',
			players: singlesPlayers
		});
		expect(after.servingSide).toBe('A');
		expect(after.serviceCourt).toBe('left'); // A score 1 → left
		expect(after.serverPlayerId).toBe('a1');
		expect(after.receiverPlayerId).toBe('b1');
	});

	test('service court is determined by the serving side score, not the rally-winner score', () => {
		// A serves with score A:10, B:8. B wins → B serves. B score 8 → even → right.
		const after = applySinglesServiceAfterRally({
			before: { ...initialState, serviceCourt: 'left' },
			scoreAfter: { A: 10, B: 9 },
			rallyWinner: 'B',
			players: singlesPlayers
		});
		expect(after.servingSide).toBe('B');
		expect(after.serviceCourt).toBe('left'); // B score 9 → odd → left
	});

	test('throws when the new serving side has no player', () => {
		expect(() =>
			applySinglesServiceAfterRally({
				before: initialState,
				scoreAfter: { A: 0, B: 1 },
				rallyWinner: 'B',
				players: [{ id: 'a1', side: 'A', order: 1, name: 'A1' }]
			})
		).toThrow('Singles match requires one player per side');
	});
});

// ─── applyDoublesServiceAfterRally ──────────────────────────────────────────

describe('applyDoublesServiceAfterRally', () => {
	const initial = createInitialDoublesServiceState({
		players: doublesPlayers,
		initialServerPlayerId: 'a1',
		initialReceiverPlayerId: 'b1'
	});
	// initial: servingSide=A, serviceCourt=right, server=a1, receiver=b1
	// courtAssignments: A:{right:a1, left:a2}, B:{right:b1, left:b2}

	test('serving side (A) wins: A pair swaps courts, receiver updates', () => {
		const after = applyDoublesServiceAfterRally({
			before: initial,
			scoreAfter: { A: 1, B: 0 },
			rallyWinner: 'A'
		});
		// A swaps: now A:{right:a2, left:a1}; serviceCourt=left (A score 1 → odd)
		// receiver = B left = b2
		expect(after.servingSide).toBe('A');
		expect(after.serviceCourt).toBe('left');
		expect(after.serverPlayerId).toBe('a1');
		expect(after.receiverPlayerId).toBe('b2');
		expect(after.courtAssignments.A).toEqual({ right: 'a2', left: 'a1' });
		expect(after.courtAssignments.B).toEqual({ right: 'b1', left: 'b2' });
	});

	test('receiving side (B) wins: service transfers, court assignments unchanged', () => {
		const after = applyDoublesServiceAfterRally({
			before: initial,
			scoreAfter: { A: 0, B: 1 },
			rallyWinner: 'B'
		});
		// New server: B left (B score 1 → odd → left) = b2; receiver: A left = a2
		expect(after.servingSide).toBe('B');
		expect(after.serviceCourt).toBe('left');
		expect(after.serverPlayerId).toBe('b2');
		expect(after.receiverPlayerId).toBe('a2');
		expect(after.courtAssignments).toEqual(initial.courtAssignments);
	});

	test('serving side wins twice: server stays same, court returns to right', () => {
		const step1 = applyDoublesServiceAfterRally({
			before: initial,
			scoreAfter: { A: 1, B: 0 },
			rallyWinner: 'A'
		});
		// After step1: A:{right:a2, left:a1}, serviceCourt=left, server=a1
		const step2 = applyDoublesServiceAfterRally({
			before: step1,
			scoreAfter: { A: 2, B: 0 },
			rallyWinner: 'A'
		});
		// A swaps again: A:{right:a1, left:a2}, serviceCourt=right (A score 2 → even)
		expect(step2.serviceCourt).toBe('right');
		expect(step2.serverPlayerId).toBe('a1');
		expect(step2.courtAssignments.A).toEqual({ right: 'a1', left: 'a2' });
	});

	test('B starts serving: B wins rally, B pair swaps courts', () => {
		const bInitial = createInitialDoublesServiceState({
			players: doublesPlayers,
			initialServerPlayerId: 'b1',
			initialReceiverPlayerId: 'a1'
		});
		const after = applyDoublesServiceAfterRally({
			before: bInitial,
			scoreAfter: { A: 0, B: 1 },
			rallyWinner: 'B'
		});
		expect(after.servingSide).toBe('B');
		expect(after.serviceCourt).toBe('left');
		expect(after.serverPlayerId).toBe('b1');
		expect(after.courtAssignments.B).toEqual({ right: 'b2', left: 'b1' });
	});

	test('B starts serving: A wins rally, service transfers to A', () => {
		const bInitial = createInitialDoublesServiceState({
			players: doublesPlayers,
			initialServerPlayerId: 'b1',
			initialReceiverPlayerId: 'a1'
		});
		const after = applyDoublesServiceAfterRally({
			before: bInitial,
			scoreAfter: { A: 1, B: 0 },
			rallyWinner: 'A'
		});
		expect(after.servingSide).toBe('A');
		expect(after.serviceCourt).toBe('left'); // A score 1 → odd
		// Court assignments unchanged (transfer, no swap on A side)
		expect(after.courtAssignments).toEqual(bInitial.courtAssignments);
	});
});
