import { dev } from '$app/environment';
import { getRequestEvent } from '$app/server';
import { createJsonCache } from '$lib/server/cache';
import { CACHE_TTL, LivePageDataSchema } from '$lib/server/cacheSchemas';
import type { LiveTopic } from '$lib/realtime/channels';
import type { LivePageData } from '$lib/server/services/livePageService';
import * as v from 'valibot';

const LIVE_PAGE_CACHE_TTL_MS = 2000;
const LIVE_PAGE_STALE_TTL_MS = 4000;
const DO_CACHE_NAME = 'live-page-cache';
const livePageTopics = new Set<LiveTopic>(['score', 'schedule', 'standings', 'finals']);

const livePageEdgeCache = createJsonCache({
	namespace: 'live-page',
	version: 1,
	schema: LivePageDataSchema,
	ttlSeconds: CACHE_TTL.livePage,
	tags: ['live']
});

const DoLivePageResponseSchema = v.object({
	ok: v.boolean(),
	data: v.optional(LivePageDataSchema),
	needsRefresh: v.optional(v.boolean())
});

const DoFetchNeededSchema = v.object({
	status: v.literal('fetch-needed')
});

type LivePageCacheEntry = {
	value: LivePageData;
	expiresAt: number;
	bornAt: number;
};

let cacheEntry: LivePageCacheEntry | null = null;
let inFlight: Promise<LivePageData> | null = null;

export async function getCachedLivePageData(
	load: () => Promise<LivePageData>,
	now = Date.now()
): Promise<LivePageData> {
	if (cacheEntry && cacheEntry.expiresAt > now) return cacheEntry.value;

	if (cacheEntry && now - cacheEntry.bornAt < LIVE_PAGE_STALE_TTL_MS) {
		refreshInBackground(load);
		return cacheEntry.value;
	}

	const edgeCached = await readLivePageFromEdgeCache(now);
	if (edgeCached) {
		cacheEntry = edgeCached;
		return edgeCached.value;
	}

	if (inFlight) {
		try {
			return await inFlight;
		} catch {
			// in-flight refresh failed; fall through to DO load
		}
	}

	const doResponse = await readLivePageFromDoDetailed(now);
	if (doResponse) {
		if (doResponse.status === 'ok') {
			cacheEntry = doResponse.entry;
			if (doResponse.needsRefresh) {
				refreshInBackground(load);
			}
			return doResponse.entry.value;
		}
		if (doResponse.status === 'fetch-needed') {
			const entry = await loadFresh(load);
			return entry.value;
		}
	}

	const entry = await loadFresh(load);
	cacheEntry = entry;
	return entry.value;
}

function refreshInBackground(load: () => Promise<LivePageData>): void {
	if (inFlight) return;
	const promise = load().then(async (value) => {
		const entry = {
			value,
			expiresAt: Date.now() + jitteredTtl(),
			bornAt: Date.now()
		};
		cacheEntry = entry;
		writeLivePageToEdgeCache(entry);
		await writeLivePageToDo(entry);
		return value;
	});

	inFlight = promise;

	promise.catch(() => {});
	promise.finally(() => {
		inFlight = null;
	});

	try {
		const event = getRequestEvent();
		event.platform?.ctx?.waitUntil?.(promise);
	} catch {
		// unit test context or outside request
	}
}

function jitteredTtl(): number {
	return LIVE_PAGE_CACHE_TTL_MS * (0.8 + Math.random() * 0.4);
}

async function loadFresh(load: () => Promise<LivePageData>): Promise<LivePageCacheEntry> {
	const value = await load();
	const entry = {
		value,
		expiresAt: Date.now() + jitteredTtl(),
		bornAt: Date.now()
	};
	cacheEntry = entry;
	writeLivePageToEdgeCache(entry);
	await writeLivePageToDo(entry);
	return entry;
}

export function invalidateLivePageCache(topics: readonly LiveTopic[]) {
	if (!topics.some((topic) => livePageTopics.has(topic))) return;

	cacheEntry = null;
	invalidateCacheDo();
	if (dev || isLocalRequest()) return; // cache.delete hangs in wrangler dev (non-standard hostname)
	void livePageEdgeCache.delete({}).catch(() => {});
}

let lastPrewarmAt = 0;

export function prewarmLivePageCache(load: () => Promise<LivePageData>): void {
	if (dev || isLocalRequest()) return;
	const now = Date.now();
	if (now - lastPrewarmAt < 3000) return;
	lastPrewarmAt = now;
	refreshInBackground(load);
}

export function clearLivePageCacheForTests() {
	cacheEntry = null;
	inFlight = null;
}

async function readLivePageFromEdgeCache(now: number): Promise<LivePageCacheEntry | null> {
	if (dev || isLocalRequest()) return null; // cache.match hangs in wrangler dev (non-standard hostname)
	try {
		const cached = await livePageEdgeCache.get({});
		if (!cached.ok || !cached.hit) return null;

		return {
			value: cached.value,
			expiresAt: now + LIVE_PAGE_CACHE_TTL_MS,
			bornAt: Date.now()
		};
	} catch {
		return null;
	}
}

function writeLivePageToEdgeCache(entry: LivePageCacheEntry): void {
	if (dev || isLocalRequest()) return; // cache.put hangs in wrangler dev (non-standard hostname)
	try {
		const task = livePageEdgeCache.set(entry.value, {}).catch(() => undefined);
		try {
			const event = getRequestEvent();
			event.platform?.ctx?.waitUntil?.(task);
		} catch {
			// no request event (unit test context) — task floats detached, fine for best-effort
		}
	} catch {
		// edge cache write is best-effort; silently ignore failures
	}
}

function isLocalRequest(): boolean {
	try {
		const event = getRequestEvent();
		const { hostname } = new URL(event.request.url);
		return (
			hostname === 'localhost' ||
			hostname === '127.0.0.1' ||
			hostname === '[::1]' ||
			hostname === '0.0.0.0'
		);
	} catch {
		return false;
	}
}

type DoResponse =
	| { status: 'ok'; entry: LivePageCacheEntry; needsRefresh: boolean }
	| { status: 'fetch-needed' }
	| { status: 'error' };

async function readLivePageFromDoDetailed(now: number): Promise<DoResponse> {
	if (dev || isLocalRequest()) return { status: 'error' };
	try {
		const event = getRequestEvent();
		const ns = event.platform?.env?.LiveBoard;
		if (!ns) return { status: 'error' };
		const stub = ns.getByName(DO_CACHE_NAME);
		const res = await stub.fetch('https://live-board.internal/cache/live-page');
		if (!res.ok) {
			if (res.status === 404) {
				try {
					const bodyResult = v.safeParse(DoFetchNeededSchema, await res.json());
					if (bodyResult.success) {
						return { status: 'fetch-needed' };
					}
				} catch {
					/* Ignore errors — cache is best-effort */
				}
			}
			return { status: 'error' };
		}
		const bodyResult = v.safeParse(DoLivePageResponseSchema, await res.json());
		if (!bodyResult.success) return { status: 'error' };
		const body = bodyResult.output;
		if (!body.ok || !body.data) return { status: 'error' };
		return {
			status: 'ok',
			entry: {
				value: body.data,
				expiresAt: now + LIVE_PAGE_CACHE_TTL_MS,
				bornAt: now
			},
			needsRefresh: !!body.needsRefresh
		};
	} catch {
		return { status: 'error' };
	}
}

async function writeLivePageToDo(entry: LivePageCacheEntry): Promise<void> {
	if (dev || isLocalRequest()) return;
	try {
		const event = getRequestEvent();
		const ns = event.platform?.env?.LiveBoard;
		if (!ns) return;
		const stub = ns.getByName(DO_CACHE_NAME);
		await stub.fetch('https://live-board.internal/cache/live-page', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ data: entry.value })
		});
	} catch {
		// DO cache write is best-effort
	}
}

export function invalidateCacheDo(): void {
	if (dev || isLocalRequest()) return;
	try {
		const event = getRequestEvent();
		const ns = event.platform?.env?.LiveBoard;
		if (!ns) return;
		const stub = ns.getByName(DO_CACHE_NAME);
		void stub
			.fetch('https://live-board.internal/cache/invalidate', { method: 'POST' })
			.then(() => undefined)
			.catch(() => undefined);
	} catch {
		// ignore errors in background invalidation
	}
}

export { LIVE_PAGE_CACHE_TTL_MS };
