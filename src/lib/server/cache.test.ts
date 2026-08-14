import { beforeEach, describe, expect, test, vi } from 'vitest';
import * as v from 'valibot';

const mockGetRequestEvent = vi.hoisted(() => vi.fn());
const mockDev = vi.hoisted(() => vi.fn(() => false));

vi.mock('$app/server', () => ({
	getRequestEvent: mockGetRequestEvent
}));

vi.mock('$app/environment', () => ({
	get dev() {
		return mockDev();
	}
}));

import { buildCacheKey, createJsonCache, normalizeKeyPart, stableStringify } from './cache';

function createMockCache(entries: Map<string, Response> = new Map()) {
	return {
		match: vi.fn(async (request: Request) => entries.get(request.url) ?? null),
		put: vi.fn(async (_request: Request, response: Response) => {
			entries.set(_request.url, response);
		}),
		delete: vi.fn(async (request: Request) => entries.delete(request.url))
	};
}

function setupEvent(options: {
	cache?: ReturnType<typeof createMockCache> | null;
	url?: string;
	ctx?: { waitUntil?: ReturnType<typeof vi.fn> };
}) {
	const cache = options.cache === undefined ? createMockCache() : options.cache;
	mockGetRequestEvent.mockReturnValue({
		url: new URL(options.url ?? 'https://example.com/'),
		request: new Request(options.url ?? 'https://example.com/'),
		platform: {
			env: {},
			ctx: { waitUntil: options.ctx?.waitUntil ?? vi.fn() },
			caches: cache ? { default: cache } : undefined
		}
	});
	return { cache };
}

describe('cache helpers', () => {
	test('stableStringify produces deterministic JSON', () => {
		expect(stableStringify({ b: 2, a: 1 })).toBe(stableStringify({ a: 1, b: 2 }));
		expect(stableStringify([3, 1, 2])).toBe('[3,1,2]');
		expect(stableStringify(null)).toBe('null');
		expect(stableStringify('hello')).toBe('"hello"');
	});

	test('normalizeKeyPart sanitizes and truncates inputs', () => {
		expect(normalizeKeyPart('hello world')).toBe('hello_world');
		expect(normalizeKeyPart(123)).toBe('123');
		expect(normalizeKeyPart(true)).toBe('true');
		expect(normalizeKeyPart(null)).toBe('null');
		expect(normalizeKeyPart(undefined)).toBe('_');
		expect(normalizeKeyPart('a'.repeat(200))).toBe('a'.repeat(120));
	});

	test('buildCacheKey creates a deterministic GET request', async () => {
		const key = await buildCacheKey({
			origin: 'https://example.com',
			namespace: 'test',
			parts: ['part one', 42],
			args: { b: 2, a: 1 }
		});

		expect(key.method).toBe('GET');
		expect(key.url).toContain('/__cache/test/v1/part_one/42/');
		expect(key.url).toContain('args-');
	});

	test('buildCacheKey uses custom pathPrefix and version', async () => {
		const key = await buildCacheKey({
			origin: 'https://example.com',
			namespace: 'ns',
			version: 2,
			pathPrefix: '/custom'
		});

		expect(key.url).toContain('/custom/ns/v2');
	});
});

describe('createJsonCache', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockDev.mockReturnValue(false);
	});

	const schema = v.object({ value: v.number() });

	function createCache(options?: { enabled?: boolean }) {
		return createJsonCache({
			namespace: 'test-cache',
			version: 1,
			schema,
			ttlSeconds: 60,
			enabled: options?.enabled ?? true
		});
	}

	test('get returns miss when disabled', async () => {
		setupEvent({ cache: createMockCache() });
		const result = await createCache({ enabled: false }).get();
		expect(result.hit).toBe(false);
	});

	test('get returns miss in dev mode', async () => {
		mockDev.mockReturnValue(true);
		setupEvent({ cache: createMockCache() });
		const result = await createCache().get();
		expect(result.hit).toBe(false);
	});

	test('get returns miss for local requests', async () => {
		setupEvent({ cache: createMockCache(), url: 'http://localhost:5173/' });
		const result = await createCache().get();
		expect(result.hit).toBe(false);
	});

	test('get returns miss when cache binding is unavailable', async () => {
		setupEvent({ cache: null });
		const result = await createCache().get();
		expect(result.hit).toBe(false);
	});

	test('get returns hit and parsed value on cache match', async () => {
		const cache = createMockCache();
		const key = await buildCacheKey({
			origin: 'https://example.com',
			namespace: 'test-cache',
			version: 1
		});
		cache.put(key, new Response(JSON.stringify({ value: 42 }), { status: 200 }));
		setupEvent({ cache });

		const result = await createCache().get();
		expect(result.hit).toBe(true);
		if (result.hit && result.ok) {
			expect(result.value).toEqual({ value: 42 });
		}
	});

	test('get returns invalid result on schema mismatch', async () => {
		const cache = createMockCache();
		const key = await buildCacheKey({
			origin: 'https://example.com',
			namespace: 'test-cache',
			version: 1
		});
		cache.put(key, new Response(JSON.stringify({ value: 'not a number' }), { status: 200 }));
		setupEvent({ cache });

		const result = await createCache().get();
		expect(result.hit).toBe(true);
		expect(result.ok).toBe(false);
	});

	test('set writes validated value to cache', async () => {
		const cache = createMockCache();
		const waitUntil = vi.fn();
		setupEvent({ cache, ctx: { waitUntil } });

		await createCache().set({ value: 7 });
		expect(cache.put).toHaveBeenCalledTimes(1);
		expect(waitUntil).toHaveBeenCalledTimes(1);
	});

	test('set can block until put completes', async () => {
		const cache = createMockCache();
		setupEvent({ cache });

		await createCache().set({ value: 7 }, { blocking: true });
		expect(cache.put).toHaveBeenCalledTimes(1);
	});

	test('set throws on invalid value', async () => {
		const cache = createMockCache();
		setupEvent({ cache });

		await expect(createCache().set({ value: 'bad' as unknown as number })).rejects.toThrow(
			'Invalid cache value for namespace "test-cache"'
		);
	});

	test('set is no-op when disabled or local', async () => {
		const localCache = createMockCache();
		setupEvent({ cache: localCache, url: 'http://localhost:5173/' });
		await createCache().set({ value: 1 });
		expect(localCache.put).not.toHaveBeenCalled();

		const devCache = createMockCache();
		mockDev.mockReturnValue(true);
		setupEvent({ cache: devCache });
		await createCache().set({ value: 1 });
		expect(devCache.put).not.toHaveBeenCalled();
	});

	test('delete removes cache entry', async () => {
		const cache = createMockCache();
		const key = await buildCacheKey({
			origin: 'https://example.com',
			namespace: 'test-cache',
			version: 1
		});
		cache.put(key, new Response(JSON.stringify({ value: 1 }), { status: 200 }));
		setupEvent({ cache });

		const result = await createCache().delete();
		expect(result).toBe(true);
		expect(cache.delete).toHaveBeenCalledTimes(1);
	});

	test('delete is no-op for local requests', async () => {
		setupEvent({ cache: createMockCache(), url: 'http://localhost:5173/' });
		const result = await createCache().delete();
		expect(result).toBe(false);
	});

	test('remember returns cached value without recomputing', async () => {
		const cache = createMockCache();
		const key = await buildCacheKey({
			origin: 'https://example.com',
			namespace: 'test-cache',
			version: 1
		});
		cache.put(key, new Response(JSON.stringify({ value: 42 }), { status: 200 }));
		setupEvent({ cache });

		const compute = vi.fn(async () => ({ value: 0 }));
		const result = await createCache().remember({}, compute);

		expect(result).toEqual({ value: 42 });
		expect(compute).not.toHaveBeenCalled();
	});

	test('remember computes, caches, and returns fresh value on miss', async () => {
		const cache = createMockCache();
		const waitUntil = vi.fn();
		setupEvent({ cache, ctx: { waitUntil } });

		const compute = vi.fn(async () => ({ value: 99 }));
		const result = await createCache().remember({}, compute, { blockingPut: true });

		expect(result).toEqual({ value: 99 });
		expect(compute).toHaveBeenCalledTimes(1);
		expect(cache.put).toHaveBeenCalledTimes(1);
	});

	test('remember recomputes on invalid cache entry by default', async () => {
		const cache = createMockCache();
		const key = await buildCacheKey({
			origin: 'https://example.com',
			namespace: 'test-cache',
			version: 1
		});
		cache.put(key, new Response(JSON.stringify({ value: 'bad' }), { status: 200 }));
		setupEvent({ cache });

		const compute = vi.fn(async () => ({ value: 5 }));
		const result = await createCache().remember({}, compute);

		expect(result).toEqual({ value: 5 });
		expect(compute).toHaveBeenCalledTimes(1);
	});

	test('remember throws on invalid cache entry when recomputeOnInvalid is false', async () => {
		const cache = createMockCache();
		const key = await buildCacheKey({
			origin: 'https://example.com',
			namespace: 'test-cache',
			version: 1
		});
		cache.put(key, new Response(JSON.stringify({ value: 'bad' }), { status: 200 }));
		setupEvent({ cache });

		const compute = vi.fn(async () => ({ value: 5 }));
		await expect(
			createCache().remember({}, compute, { recomputeOnInvalid: false })
		).rejects.toThrow('Invalid cache entry for namespace "test-cache"');
		expect(compute).not.toHaveBeenCalled();
	});
});
