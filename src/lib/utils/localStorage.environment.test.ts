import { describe, expect, test, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false, dev: false, building: false }));

import {
	loadJsonFromLocalStorage,
	removeLocalStorageItem,
	saveJsonToLocalStorage
} from './localStorage';
import * as v from 'valibot';

const schema = v.object({ name: v.string() });

describe('localStorage helpers in non-browser environment', () => {
	test('load returns null without touching localStorage', () => {
		expect(loadJsonFromLocalStorage('key', schema)).toBeNull();
	});

	test('save returns null without touching localStorage', () => {
		expect(saveJsonToLocalStorage('key', schema, { name: 'x' })).toBeNull();
	});

	test('remove does not throw', () => {
		expect(() => removeLocalStorageItem('key')).not.toThrow();
	});
});
