import { getRequestEvent } from '$app/server';
import type { LiveTopic } from '$lib/realtime/channels';
import type { LivePageData } from '$lib/server/services/livePageService';

const LIVE_PAGE_CACHE_TTL_MS = 5_000;
const LIVE_PAGE_CACHE_KEY = 'https://live-cache.internal/live-page-data';
const LIVE_PAGE_CACHE_EXPIRY_HEADER = 'x-live-cache-expires-at';
const livePageTopics = new Set<LiveTopic>(['score', 'schedule', 'standings', 'finals']);

type LivePageCacheEntry = {
	value: LivePageData;
	expiresAt: number;
};

let cacheEntry: LivePageCacheEntry | null = null;
let inFlight: Promise<LivePageData> | null = null;

export async function getCachedLivePageData(
	load: () => Promise<LivePageData>,
	now = Date.now()
): Promise<LivePageData> {
	if (cacheEntry && cacheEntry.expiresAt > now) return cacheEntry.value;

	const edgeCached = await readLivePageFromEdgeCache(now);
	if (edgeCached) {
		cacheEntry = edgeCached;
		return edgeCached.value;
	}

	if (inFlight) return inFlight;

	inFlight = load().then(async (value) => {
		const entry = {
			value,
			expiresAt: Date.now() + LIVE_PAGE_CACHE_TTL_MS
		};
		cacheEntry = entry;
		await writeLivePageToEdgeCache(entry);
		return value;
	});

	try {
		return await inFlight;
	} finally {
		inFlight = null;
	}
}

export function invalidateLivePageCache(topics: readonly LiveTopic[]) {
	if (!topics.some((topic) => livePageTopics.has(topic))) return;

	cacheEntry = null;
	const cache = getEdgeCache();
	if (!cache) return;
	void runInBackground(cache.delete(buildLivePageCacheRequest()));
}

export function clearLivePageCacheForTests() {
	cacheEntry = null;
	inFlight = null;
}

async function readLivePageFromEdgeCache(now: number): Promise<LivePageCacheEntry | null> {
	const cache = getEdgeCache();
	if (!cache) return null;

	const response = await cache.match(buildLivePageCacheRequest());
	if (!response) return null;

	const expiresAt = Number(response.headers.get(LIVE_PAGE_CACHE_EXPIRY_HEADER) ?? 0);
	if (!Number.isFinite(expiresAt) || expiresAt <= now) {
		void runInBackground(cache.delete(buildLivePageCacheRequest()));
		return null;
	}

	return {
		value: (await response.json()) as LivePageData,
		expiresAt
	};
}

async function writeLivePageToEdgeCache(entry: LivePageCacheEntry): Promise<void> {
	const cache = getEdgeCache();
	if (!cache) return;

	await runInBackground(
		cache.put(
			buildLivePageCacheRequest(),
			new Response(JSON.stringify(entry.value), {
				headers: {
					'content-type': 'application/json; charset=utf-8',
					'cache-control': `max-age=${Math.floor(LIVE_PAGE_CACHE_TTL_MS / 1000)}`,
					[LIVE_PAGE_CACHE_EXPIRY_HEADER]: String(entry.expiresAt)
				}
			})
		)
	);
}

function buildLivePageCacheRequest() {
	return new Request(LIVE_PAGE_CACHE_KEY, { method: 'GET' });
}

function getEdgeCache(): Cache | null {
	const cacheStorage = globalThis.caches as (CacheStorage & { default?: Cache }) | undefined;
	return cacheStorage?.default ?? null;
}

async function runInBackground<T>(task: Promise<T>): Promise<T> {
	try {
		const event = getRequestEvent();
		event.platform?.ctx?.waitUntil?.(task.then(() => undefined));
	} catch {
		// No request event in unit tests or non-request execution.
	}
	return task;
}

export { LIVE_PAGE_CACHE_TTL_MS };
