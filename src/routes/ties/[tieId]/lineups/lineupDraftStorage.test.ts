import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true, dev: false, building: false }));

import { RUBBER_DEFINITIONS } from '$lib/domain/tokyoLeague';
import {
	clearLocalLineupDraft,
	lineupDraftItemsFromFormData,
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

	test('builds a draft from form data in rubber order', () => {
		const formData = new FormData();
		for (const [index, rubber] of RUBBER_DEFINITIONS.entries()) {
			formData.set(`items[${index}].player1Id`, `${rubber.code}-p1`);
			formData.set(`items[${index}].player2Id`, `${rubber.code}-p2`);
		}

		expect(lineupDraftItemsFromFormData(formData)).toEqual(
			RUBBER_DEFINITIONS.map((rubber) => ({
				rubberCode: rubber.code,
				player1Id: `${rubber.code}-p1`,
				player2Id: `${rubber.code}-p2`
			}))
		);
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

	test('returns null when no draft is stored', () => {
		const tieId = 'tie-2';
		const teamId = 'team-b';

		expect(loadLocalLineupDraft(tieId, teamId)).toBeNull();
	});
});
