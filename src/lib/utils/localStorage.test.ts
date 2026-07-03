import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true, dev: false, building: false }));

import * as v from 'valibot';
import {
	loadJsonFromLocalStorage,
	removeLocalStorageItem,
	saveJsonToLocalStorage
} from './localStorage';

const schema = v.object({
	name: v.string(),
	count: v.number()
});

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

describe('localStorage helpers', () => {
	beforeEach(() => {
		const localStorage = createLocalStorageMock();
		Object.defineProperty(globalThis, 'localStorage', {
			value: localStorage,
			configurable: true
		});
	});

	test('saves validated values and loads them back', () => {
		const value = saveJsonToLocalStorage('key', schema, { name: 'Alice', count: 2 });

		expect(value).toEqual({ name: 'Alice', count: 2 });
		expect(loadJsonFromLocalStorage('key', schema)).toEqual({ name: 'Alice', count: 2 });
	});

	test('returns null and does not save invalid values', () => {
		expect(saveJsonToLocalStorage('key', schema, { name: 'Alice' })).toBeNull();
		expect(loadJsonFromLocalStorage('key', schema)).toBeNull();
	});

	test('returns null for malformed stored json', () => {
		localStorage.setItem('key', '{not-json');

		expect(loadJsonFromLocalStorage('key', schema)).toBeNull();
	});

	test('removes stored values', () => {
		localStorage.setItem('key', JSON.stringify({ name: 'Alice', count: 2 }));
		removeLocalStorageItem('key');

		expect(localStorage.getItem('key')).toBeNull();
	});
});
