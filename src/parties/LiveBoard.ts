import { Server, type Connection } from 'partyserver';
import { liveMessageSchema, type LiveMessage } from '$lib/realtime/channels';
import { LivePageDataSchema } from '$lib/server/cacheSchemas';
import type { LivePageData } from '$lib/server/services/livePageService';
import * as v from 'valibot';

const ALLOWED_INTERNAL_HOST = 'live-board.internal';
const LIVE_PAGE_CACHE_KEY = 'cached-live-page-data';
const CACHE_TTL_MS = 30_000;
const LivePageCachePutSchema = v.object({ data: v.unknown() });

type CachedLivePageEntry = { data: LivePageData; expiresAt: number };

export class LiveBoard extends Server<Env> {
	static options = { hibernate: true };

	private cachedData: CachedLivePageEntry | null = null;
	private isFetching = false;
	private waiters: Array<(value: CachedLivePageEntry | null) => void> = [];
	private fetchTimeout: ReturnType<typeof setTimeout> | null = null;

	async onConnect(connection: Connection) {
		const hello: LiveMessage = { type: 'hello', at: new Date().toISOString() };
		connection.send(JSON.stringify(hello));
	}

	async onRequest(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const isInternal = url.hostname === ALLOWED_INTERNAL_HOST;
		if (!isInternal) {
			return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
		}

		if (request.method === 'GET' && url.pathname === '/cache/live-page') {
			return this.handleCacheGet();
		}

		if (request.method === 'PUT' && url.pathname === '/cache/live-page') {
			return this.handleCachePut(request);
		}

		if (request.method === 'POST' && url.pathname === '/cache/invalidate') {
			return this.handleCacheInvalidate();
		}

		if (request.method === 'POST') {
			let raw: unknown;
			try {
				raw = await request.json();
			} catch {
				return Response.json({ ok: false, error: 'invalid json' }, { status: 400 });
			}
			const parsed = v.safeParse(liveMessageSchema, raw);
			if (!parsed.success) {
				return Response.json({ ok: false, error: 'invalid message' }, { status: 400 });
			}
			this.broadcast(JSON.stringify(parsed.output));
			return Response.json({ ok: true });
		}
		return new Response('Not found', { status: 404 });
	}

	private async handleCacheGet(): Promise<Response> {
		const now = Date.now();

		// 1. If valid cache in memory, return it
		if (this.cachedData && this.cachedData.expiresAt > now) {
			return Response.json({ ok: true, data: this.cachedData.data, from: 'do-mem' });
		}

		// 2. If valid/stale cache exists in storage, read it once to populate memory
		if (!this.cachedData) {
			const cached = await this.ctx.storage.get<{
				data: LivePageData;
				expiresAt: number;
			}>(LIVE_PAGE_CACHE_KEY);
			if (cached) {
				this.cachedData = cached;
			}
		}

		// 3. If cache is valid (now populated), return it
		if (this.cachedData && this.cachedData.expiresAt > now) {
			return Response.json({ ok: true, data: this.cachedData.data, from: 'do-storage' });
		}

		// 4. If cache exists but is stale, we can return it but tell the caller to refresh in background
		if (this.cachedData) {
			if (this.isFetching) {
				return Response.json({ ok: true, data: this.cachedData.data, from: 'do-stale-fetching' });
			} else {
				this.startFetchTimer();
				return Response.json({
					ok: true,
					data: this.cachedData.data,
					from: 'do-stale-needs-refresh',
					needsRefresh: true
				});
			}
		}

		// 5. If no cache exists at all (empty cache)
		if (this.isFetching) {
			// Already fetching, wait for the result
			const newCache = await new Promise<CachedLivePageEntry | null>((resolve) => {
				this.waiters.push(resolve);
			});
			if (newCache) {
				return Response.json({ ok: true, data: newCache.data, from: 'do-waited' });
			} else {
				// Waiter failed/timed out, try fallback
				return Response.json({ ok: false, error: 'fetch timeout' }, { status: 504 });
			}
		} else {
			// We need to fetch. Mark as fetching and tell the caller to query D1.
			this.startFetchTimer();
			return Response.json({ ok: false, status: 'fetch-needed' }, { status: 404 });
		}
	}

	private async handleCachePut(request: Request): Promise<Response> {
		try {
			const raw = await request.json();
			const parsed = v.safeParse(LivePageCachePutSchema, raw);
			if (!parsed.success) {
				return Response.json({ ok: false, error: 'invalid payload' }, { status: 400 });
			}
			const livePageDataResult = v.safeParse(LivePageDataSchema, parsed.output.data);
			if (!livePageDataResult.success) {
				return Response.json({ ok: false, error: 'invalid payload' }, { status: 400 });
			}
			const expiresAt = Date.now() + CACHE_TTL_MS * (0.8 + Math.random() * 0.4);
			const entry: CachedLivePageEntry = { data: livePageDataResult.output, expiresAt };
			this.cachedData = entry; // save in memory
			void this.ctx.storage.put(LIVE_PAGE_CACHE_KEY, entry).catch(() => {}); // save in storage asynchronously

			// Clear fetching flag and resolve all waiters
			this.clearFetchTimer();
			const currentWaiters = this.waiters;
			this.waiters = [];
			for (const resolve of currentWaiters) {
				resolve(entry);
			}

			return Response.json({ ok: true });
		} catch {
			return Response.json({ ok: false, error: 'invalid payload' }, { status: 400 });
		}
	}

	private async handleCacheInvalidate(): Promise<Response> {
		if (this.cachedData) {
			this.cachedData.expiresAt = 0; // mark as stale
			void this.ctx.storage.put(LIVE_PAGE_CACHE_KEY, this.cachedData).catch(() => {});
		} else {
			void this.ctx.storage.delete(LIVE_PAGE_CACHE_KEY).catch(() => {});
		}
		// If cache is invalidated, we also clear any active fetch timer and waiters
		this.clearFetchTimer();
		const currentWaiters = this.waiters;
		this.waiters = [];
		for (const resolve of currentWaiters) {
			resolve(this.cachedData);
		}
		return Response.json({ ok: true });
	}

	private startFetchTimer() {
		this.isFetching = true;
		if (this.fetchTimeout) {
			clearTimeout(this.fetchTimeout);
		}
		this.fetchTimeout = setTimeout(() => {
			this.isFetching = false;
			this.fetchTimeout = null;
			// Notify waiters with null (failed/timed out)
			const currentWaiters = this.waiters;
			this.waiters = [];
			for (const resolve of currentWaiters) {
				resolve(null);
			}
		}, 2000); // 2 seconds timeout
	}

	private clearFetchTimer() {
		this.isFetching = false;
		if (this.fetchTimeout) {
			clearTimeout(this.fetchTimeout);
			this.fetchTimeout = null;
		}
	}

	async onClose() {
		// no-op
	}

	async onError() {
		// no-op
	}
}
