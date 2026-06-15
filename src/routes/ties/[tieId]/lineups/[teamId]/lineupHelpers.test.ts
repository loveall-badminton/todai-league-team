import { describe, expect, test } from 'vitest';
import {
	lineupStatusBadgeClass,
	filteredPlayers,
	slotLabel,
	savedPlayerValue,
	type LineupItem
} from './lineupHelpers';

// ─── lineupStatusBadgeClass ───────────────────────────────────────────────────

describe('lineupStatusBadgeClass', () => {
	test.each([
		['draft', 'bg-zinc-100 text-zinc-600'],
		['submitted', 'bg-blue-100 text-blue-700'],
		['locked', 'bg-violet-100 text-violet-700'],
		['revealed', 'bg-emerald-100 text-emerald-700']
	])('status=%s returns correct class', (status, expected) => {
		expect(lineupStatusBadgeClass(status)).toBe(expected);
	});

	test('null → muted zinc class', () => {
		expect(lineupStatusBadgeClass(null)).toBe('bg-zinc-100 text-zinc-400');
	});

	test('unknown status → zinc fallback with slightly darker text', () => {
		expect(lineupStatusBadgeClass('pending')).toBe('bg-zinc-100 text-zinc-500');
	});
});

// ─── filteredPlayers ──────────────────────────────────────────────────────────

type P = { id: string; gender: string };

const players: P[] = [
	{ id: 'f1', gender: 'female' },
	{ id: 'f2', gender: 'female' },
	{ id: 'm1', gender: 'male' },
	{ id: 'm2', gender: 'male' },
	{ id: 'u1', gender: 'unknown' }
];

describe('filteredPlayers', () => {
	// ── WD (women's doubles) ──────────────────────────────────────────────────
	test('WD order 1 → only females and unknowns', () => {
		const result = filteredPlayers('WD', 1, players);
		expect(result.map((p) => p.id)).toEqual(['f1', 'f2', 'u1']);
	});

	test('WD order 2 → same as order 1 (both female)', () => {
		const result = filteredPlayers('WD', 2, players);
		expect(result.map((p) => p.id)).toEqual(['f1', 'f2', 'u1']);
	});

	// ── MD (men's doubles) ────────────────────────────────────────────────────
	test('MD order 1 → only males and unknowns', () => {
		const result = filteredPlayers('MD', 1, players);
		expect(result.map((p) => p.id)).toEqual(['m1', 'm2', 'u1']);
	});

	test('MD order 2 → same as order 1 (both male)', () => {
		const result = filteredPlayers('MD', 2, players);
		expect(result.map((p) => p.id)).toEqual(['m1', 'm2', 'u1']);
	});

	// ── XD (mixed doubles) ────────────────────────────────────────────────────
	test('XD order 1 → females and unknowns (female slot)', () => {
		const result = filteredPlayers('XD', 1, players);
		expect(result.map((p) => p.id)).toEqual(['f1', 'f2', 'u1']);
	});

	test('XD order 2 → males and unknowns (male slot)', () => {
		const result = filteredPlayers('XD', 2, players);
		expect(result.map((p) => p.id)).toEqual(['m1', 'm2', 'u1']);
	});

	// ── Singles (MS/WS) or other ──────────────────────────────────────────────
	test('MS (other discipline) → all players returned', () => {
		const result = filteredPlayers('MS', 1, players);
		expect(result).toHaveLength(5);
	});

	test('WS (other discipline) → all players returned', () => {
		const result = filteredPlayers('WS', 1, players);
		expect(result).toHaveLength(5);
	});

	test('unknown gender always passes through for any discipline', () => {
		const unknownOnly = [{ id: 'u', gender: 'unknown' }];
		expect(filteredPlayers('WD', 1, unknownOnly)).toHaveLength(1);
		expect(filteredPlayers('MD', 1, unknownOnly)).toHaveLength(1);
		expect(filteredPlayers('XD', 1, unknownOnly)).toHaveLength(1);
		expect(filteredPlayers('XD', 2, unknownOnly)).toHaveLength(1);
	});

	test('empty players list → empty result', () => {
		expect(filteredPlayers('XD', 1, [])).toEqual([]);
	});

	test('preserves all player fields via generic', () => {
		type ExtendedPlayer = { id: string; gender: string; name: string };
		const ep: ExtendedPlayer[] = [{ id: 'f', gender: 'female', name: 'Alice' }];
		const result = filteredPlayers<ExtendedPlayer>('WD', 1, ep);
		expect(result[0].name).toBe('Alice');
	});
});

// ─── slotLabel ────────────────────────────────────────────────────────────────

describe('slotLabel', () => {
	test('XD order 1 → 女性', () => {
		expect(slotLabel('XD', 1)).toBe('女性');
	});

	test('XD order 2 → 男性', () => {
		expect(slotLabel('XD', 2)).toBe('男性');
	});

	test('WD order 1 → 1人目', () => {
		expect(slotLabel('WD', 1)).toBe('1人目');
	});

	test('WD order 2 → 2人目', () => {
		expect(slotLabel('WD', 2)).toBe('2人目');
	});

	test('MD order 1 → 1人目', () => {
		expect(slotLabel('MD', 1)).toBe('1人目');
	});

	test('MS (singles) order 1 → 1人目', () => {
		expect(slotLabel('MS', 1)).toBe('1人目');
	});
});

// ─── savedPlayerValue ─────────────────────────────────────────────────────────

describe('savedPlayerValue', () => {
	const items: LineupItem[] = [
		{ rubberCode: 'MS1', player1Id: 'p1', player2Id: null },
		{ rubberCode: 'WD1', player1Id: 'p2', player2Id: 'p3' },
		{ rubberCode: 'MD1', player1Id: null, player2Id: null }
	];

	test('order 1 returns player1Id', () => {
		expect(savedPlayerValue('WD1', 1, items)).toBe('p2');
	});

	test('order 2 returns player2Id', () => {
		expect(savedPlayerValue('WD1', 2, items)).toBe('p3');
	});

	test('player1Id null → empty string', () => {
		expect(savedPlayerValue('MD1', 1, items)).toBe('');
	});

	test('player2Id null → empty string', () => {
		expect(savedPlayerValue('MD1', 2, items)).toBe('');
	});

	test('order 2 for singles item (player2Id null) → empty string', () => {
		expect(savedPlayerValue('MS1', 2, items)).toBe('');
	});

	test('rubberCode not found → empty string for order 1', () => {
		expect(savedPlayerValue('XD1', 1, items)).toBe('');
	});

	test('rubberCode not found → empty string for order 2', () => {
		expect(savedPlayerValue('XD1', 2, items)).toBe('');
	});

	test('empty items array → empty string', () => {
		expect(savedPlayerValue('MS1', 1, [])).toBe('');
	});
});
