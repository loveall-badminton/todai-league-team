import { describe, expect, test } from 'vitest';
import { resolvePlayersCache } from './matchActionCache';
import type { MatchPlayer } from '$lib/domain/types';

function player(id: string, name: string): MatchPlayer {
	return { id, name, side: 'A', order: 1, teamName: null };
}

describe('resolvePlayersCache', () => {
	test('uses and caches client-supplied players on first call', () => {
		const clientPlayers = [player('p1', 'Alice')];
		const { players, nextCache } = resolvePlayersCache(clientPlayers, undefined);

		expect(players).toBe(clientPlayers);
		expect(nextCache).toBe(clientPlayers);
	});

	test('falls back to the cache when the client omits players', () => {
		const cached = [player('p1', 'Alice')];
		const { players, nextCache } = resolvePlayersCache(undefined, cached);

		expect(players).toBe(cached);
		expect(nextCache).toBe(cached);
	});

	test('refreshes a stale cache when the client sends updated players (roster change mid-match)', () => {
		const stale = [player('p1', 'Alice')];
		const updated = [player('p1', 'Alice'), player('p2', 'Bob (sub)')];

		const { players, nextCache } = resolvePlayersCache(updated, stale);

		expect(players).toBe(updated);
		expect(nextCache).toBe(updated);
	});

	test('returns undefined when neither client nor cache has players', () => {
		const { players, nextCache } = resolvePlayersCache(undefined, undefined);

		expect(players).toBeUndefined();
		expect(nextCache).toBeUndefined();
	});
});
