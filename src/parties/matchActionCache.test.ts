import { describe, expect, test } from 'vitest';
import { resolvePlayersCache } from './matchActionCache';
import type { MatchPlayer } from '$lib/domain/types';

function player(id: string, name: string): MatchPlayer {
	return { id, name, side: 'A', order: 1, teamName: null };
}

describe('resolvePlayersCache', () => {
	test('uses client-supplied players on first call', () => {
		const clientPlayers = [player('p1', 'Alice')];

		expect(resolvePlayersCache(clientPlayers, undefined)).toBe(clientPlayers);
	});

	test('falls back to the cache when the client omits players', () => {
		const cached = [player('p1', 'Alice')];

		expect(resolvePlayersCache(undefined, cached)).toBe(cached);
	});

	test('prefers updated client players over a stale cache (roster change mid-match)', () => {
		const stale = [player('p1', 'Alice')];
		const updated = [player('p1', 'Alice'), player('p2', 'Bob (sub)')];

		expect(resolvePlayersCache(updated, stale)).toBe(updated);
	});

	test('returns undefined when neither client nor cache has players', () => {
		expect(resolvePlayersCache(undefined, undefined)).toBeUndefined();
	});
});
