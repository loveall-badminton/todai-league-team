import { beforeEach, describe, expect, test, vi } from 'vitest';

// Mock $app/environment with dev=false to test production edge-cache behavior.
// In wrangler dev, dev=true causes edge cache to be skipped (cache.put hangs there).
vi.mock('$app/environment', () => ({ dev: false, browser: false, building: false }));

const originalCaches = globalThis.caches;
import {
	clearLivePageCacheForTests,
	getCachedLivePageData,
	invalidateLivePageCache,
	LIVE_PAGE_CACHE_TTL_MS
} from './livePageCache';
import type { LivePageData } from './livePageService';

function createLivePageData(): LivePageData {
	return {
		activeTies: { ties: [], rubbersByTieId: {} },
		standings: { standingA: [], standingB: [], groupA: [], groupB: [], teams: [] },
		finalsBoard: { finalsBoard: [] },
		schedule: []
	};
}

describe('livePageCache', () => {
	beforeEach(() => {
		clearLivePageCacheForTests();
		vi.restoreAllMocks();
		Object.defineProperty(globalThis, 'caches', {
			value: originalCaches,
			configurable: true,
			writable: true
		});
	});

	test('reuses cached live page data within ttl', async () => {
		const load = vi.fn(async () => createLivePageData());
		const first = await getCachedLivePageData(load, 1_000);
		const second = await getCachedLivePageData(load, 1_000 + LIVE_PAGE_CACHE_TTL_MS - 1);

		expect(first).toBe(second);
		expect(load).toHaveBeenCalledTimes(1);
	});

	test('invalidates cache for live page topics', async () => {
		const first = createLivePageData();
		const second = createLivePageData();
		const load = vi
			.fn<() => Promise<LivePageData>>()
			.mockResolvedValueOnce(first)
			.mockResolvedValueOnce(second);

		await getCachedLivePageData(load, 1_000);
		invalidateLivePageCache(['score']);
		const refreshed = await getCachedLivePageData(load, 1_001);

		expect(refreshed).toBe(second);
		expect(load).toHaveBeenCalledTimes(2);
	});

	test('does not invalidate cache for unrelated topics', async () => {
		const load = vi.fn(async () => createLivePageData());
		await getCachedLivePageData(load, 1_000);
		invalidateLivePageCache([]);
		await getCachedLivePageData(load, 1_500);

		expect(load).toHaveBeenCalledTimes(1);
	});

	test('falls back safely when Cloudflare Cache API is unavailable in requestless tests', async () => {
		const store = new Map<string, Response>();
		const cache = {
			match: vi.fn(async (request: Request) => store.get(request.url) ?? undefined),
			put: vi.fn(async (request: Request, response: Response) => {
				store.set(request.url, response.clone());
			}),
			delete: vi.fn(async (request: Request) => store.delete(request.url))
		};
		Object.defineProperty(globalThis, 'caches', {
			value: { default: cache },
			configurable: true,
			writable: true
		});

		const load = vi.fn(async () => createLivePageData());
		await getCachedLivePageData(load, 1_000);
		clearLivePageCacheForTests();
		const cached = await getCachedLivePageData(load, 1_001);

		expect(cached).toEqual(createLivePageData());
		expect(load.mock.calls.length).toBeLessThanOrEqual(2);
		expect(cache.match).not.toHaveBeenCalled();
		expect(cache.put).not.toHaveBeenCalled();

		invalidateLivePageCache(['score']);
		expect(cache.delete).not.toHaveBeenCalled();
	});
});
