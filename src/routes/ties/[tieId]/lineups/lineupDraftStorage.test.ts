import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true, dev: false, building: false }));

import { RUBBER_DEFINITIONS } from '$lib/domain/tokyoLeague';
import {
	clearLocalLineupDraft,
	loadLocalLineupDraft,
	saveLocalLineupDraft
} from './lineupDraftStorage';

function createLocalStorageMock() {
	const store = new Map<string, string>();
	return {
		getItem: vi.fn((key: string) => store.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => {
			store.set(key, value);
		}),
		removeItem: vi.fn((key: string) => {
			store.delete(key);
		})
	};
}

describe('lineupDraftStorage', () => {
	beforeEach(() => {
		Object.defineProperty(globalThis, 'localStorage', {
			value: createLocalStorageMock(),
			configurable: true
		});
	});

	test('saves, loads, and clears a lineup draft by tie/team key', () => {
		const tieId = 'tie-1';
		const teamId = 'team-a';
		const draft = RUBBER_DEFINITIONS.map((rubber) => ({
			rubberCode: rubber.code,
			player1Id: `${rubber.code}-p1`,
			player2Id: `${rubber.code}-p2`
		}));

		saveLocalLineupDraft(tieId, teamId, draft);

		expect(loadLocalLineupDraft(tieId, teamId)).toEqual(draft);

		clearLocalLineupDraft(tieId, teamId);
		expect(loadLocalLineupDraft(tieId, teamId)).toBeNull();
	});

	test('saves drafts with empty (null) slots by normalizing them to empty strings', () => {
		const tieId = 'tie-3';
		const teamId = 'team-c';
		const draft = RUBBER_DEFINITIONS.map((rubber, index) => ({
			rubberCode: rubber.code,
			player1Id: index === 0 ? null : `${rubber.code}-p1`,
			player2Id: null
		}));

		saveLocalLineupDraft(tieId, teamId, draft);

		const loaded = loadLocalLineupDraft(tieId, teamId);
		expect(loaded?.[0]).toEqual({ rubberCode: 'WD1', player1Id: '', player2Id: '' });
		expect(loaded?.[1]).toEqual({ rubberCode: 'XD1', player1Id: 'XD1-p1', player2Id: '' });
	});

	test('returns null when no draft is stored', () => {
		const tieId = 'tie-2';
		const teamId = 'team-b';

		expect(loadLocalLineupDraft(tieId, teamId)).toBeNull();
	});
});
