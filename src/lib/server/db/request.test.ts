import { describe, expect, test, vi } from 'vitest';

const mockGetRequestEvent = vi.hoisted(() => vi.fn());
const mockGetDb = vi.hoisted(() => vi.fn());

vi.mock('$app/server', () => ({
	getRequestEvent: mockGetRequestEvent
}));

vi.mock('./client', () => ({
	getDb: mockGetDb
}));

import { getRequestDb } from './request';

describe('getRequestDb', () => {
	test('returns DB client when binding is present', () => {
		const db = { $client: {} };
		mockGetRequestEvent.mockReturnValue({
			platform: { env: { DB: db } }
		});
		mockGetDb.mockReturnValue('db-client');

		expect(getRequestDb()).toBe('db-client');
		expect(mockGetDb).toHaveBeenCalledWith(db);
	});

	test('throws 500 when DB binding is missing', () => {
		mockGetRequestEvent.mockReturnValue({
			platform: { env: {} }
		});

		try {
			getRequestDb();
		} catch (e) {
			expect(e).toMatchObject({ status: 500, body: { message: 'D1 binding DB is not available' } });
			return;
		}
		throw new Error('expected getRequestDb to throw');
	});

	test('throws 500 when platform is missing', () => {
		mockGetRequestEvent.mockReturnValue({});

		try {
			getRequestDb();
		} catch (e) {
			expect(e).toMatchObject({ status: 500, body: { message: 'D1 binding DB is not available' } });
			return;
		}
		throw new Error('expected getRequestDb to throw');
	});
});
