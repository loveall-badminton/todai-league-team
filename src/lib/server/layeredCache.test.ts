import { beforeEach, describe, expect, test, vi } from 'vitest';
import * as v from 'valibot';

const mockGetRequestEvent = vi.hoisted(() => vi.fn());

vi.mock('$app/server', () => ({
	getRequestEvent: mockGetRequestEvent
}));

import { createLayeredJsonCache } from './layeredCache';

const schema = v.object({ value: v.number() });

function createCache() {
	return createLayeredJsonCache({
		namespace: 'test-cache',
		version: 1,
		schema,
		ttlSeconds: 3,
		invalidateOn: ['score']
	});
}

function setupEvent(params: { doResponse?: Response | null; fetchSpy?: ReturnType<typeof vi.fn> }) {
	const fetchSpy =
		params.fetchSpy ??
		vi.fn(async () => params.doResponse ?? Response.json({ ok: false, epoch: 5 }, { status: 404 }));
	const waitUntil = vi.fn();
	mockGetRequestEvent.mockReturnValue({
		url: new URL('https://example.com/'),
		request: new Request('https://example.com/'),
		platform: {
			env: { LiveBoard: { getByName: () => ({ fetch: fetchSpy }) } },
			ctx: { waitUntil },
			caches: undefined
		}
	});
	return { fetchSpy, waitUntil };
}

describe('createLayeredJsonCache', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('returns DO-cached value without recomputing', async () => {
		const { fetchSpy } = setupEvent({
			doResponse: Response.json({ ok: true, data: { value: 42 }, epoch: 5 })
		});
		const compute = vi.fn(async () => ({ value: 0 }));

		const result = await createCache().remember({ parts: ['a'] }, compute);

		expect(result).toEqual({ value: 42 });
		expect(compute).not.toHaveBeenCalled();
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});

	test('computes on DO miss and writes the fresh value back with topics', async () => {
		const { fetchSpy } = setupEvent({});
		const compute = vi.fn(async () => ({ value: 7 }));

		const result = await createCache().remember({ parts: ['a'] }, compute);

		expect(result).toEqual({ value: 7 });
		expect(compute).toHaveBeenCalledTimes(1);

		const putCall = fetchSpy.mock.calls.find(
			(call: unknown[]) => (call[1] as RequestInit | undefined)?.method === 'PUT'
		);
		expect(putCall).toBeDefined();
		const body = JSON.parse(String((putCall![1] as RequestInit).body)) as {
			key: string;
			data: unknown;
			topics: string[];
			epoch: number;
		};
		expect(body).toMatchObject({ data: { value: 7 }, topics: ['score'], epoch: 5 });
		expect(body.key).toContain('test-cache');
		expect(body.key).toContain('/a');
	});

	test('recomputes when DO returns schema-invalid data', async () => {
		setupEvent({ doResponse: Response.json({ ok: true, data: { value: 'broken' }, epoch: 5 }) });
		const compute = vi.fn(async () => ({ value: 1 }));

		const result = await createCache().remember({ parts: ['a'] }, compute);

		expect(result).toEqual({ value: 1 });
		expect(compute).toHaveBeenCalledTimes(1);
	});

	test('falls back to compute when the LiveBoard binding is unavailable', async () => {
		mockGetRequestEvent.mockReturnValue({
			url: new URL('https://example.com/'),
			request: new Request('https://example.com/'),
			platform: { env: {}, ctx: { waitUntil: vi.fn() }, caches: undefined }
		});
		const compute = vi.fn(async () => ({ value: 3 }));

		const result = await createCache().remember({ parts: ['a'] }, compute);

		expect(result).toEqual({ value: 3 });
		expect(compute).toHaveBeenCalledTimes(1);
	});

	test('skips the DO write when no epoch could be obtained', async () => {
		const fetchSpy = vi.fn(async () => Response.json({ unexpected: true }, { status: 404 }));
		setupEvent({ fetchSpy });
		const compute = vi.fn(async () => ({ value: 5 }));

		const result = await createCache().remember({ parts: ['a'] }, compute);

		expect(result).toEqual({ value: 5 });
		const putCall = fetchSpy.mock.calls.find(
			(call: unknown[]) => (call[1] as RequestInit | undefined)?.method === 'PUT'
		);
		expect(putCall).toBeUndefined();
	});

	test('falls back to compute when the DO fetch fails', async () => {
		const fetchSpy = vi.fn(async () => {
			throw new Error('DO unreachable');
		});
		setupEvent({ fetchSpy });
		const compute = vi.fn(async () => ({ value: 9 }));

		const result = await createCache().remember({ parts: ['a'] }, compute);

		expect(result).toEqual({ value: 9 });
		expect(compute).toHaveBeenCalledTimes(1);
	});
});
