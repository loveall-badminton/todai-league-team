import type { Handle } from '@sveltejs/kit';
import { building, dev } from '$app/environment';
import { createAuth } from '$lib/server/auth';
import { getAuthProfile } from '$lib/server/auth/access';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { checkRateLimit, API_RATE_LIMIT, AUTH_RATE_LIMIT } from '$lib/server/ratelimit';

const PUBLIC_PATHS = ['/auth/login', '/auth/bootstrap'];
const PROFILE_PATHS = ['/admin', '/ties', '/scores', '/referee', '/live'];

const authCache = new WeakMap<D1Database, ReturnType<typeof createAuth>>();

function isMutation(method: string) {
	return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
}

interface SessionCacheEntry {
	session: unknown;
	expiresAt: number;
}
const sessionCache = new Map<string, SessionCacheEntry>();

function getCookieValue(cookieHeader: string, name: string): string | null {
	const parts = cookieHeader.split(';');
	for (const part of parts) {
		const [rawKey, ...rawValue] = part.trim().split('=');
		if (rawKey === name) {
			return rawValue.join('=') || null;
		}
	}
	return null;
}

function getAuthCacheKey(request: Request): string | null {
	const authorization = request.headers.get('authorization');
	if (authorization) return `bearer:${authorization}`;
	const cookie = request.headers.get('cookie') ?? '';
	const token =
		getCookieValue(cookie, 'better-auth.session_token') ??
		getCookieValue(cookie, '__Secure-better-auth.session_token');
	if (!token) return null;
	return `session:${token}`;
}

// Cross-isolate session cache using CF Edge Cache (shared per datacenter, avoids HMAC re-verification)
const SESSION_CACHE_NS = 'https://auth-session.internal/v1/';

function getEdgeCache(): Cache | null {
	const cacheStorage = globalThis.caches as (CacheStorage & { default?: Cache }) | undefined;
	return cacheStorage?.default ?? null;
}

function isLocalHostname(request: Request): boolean {
	try {
		const { hostname } = new URL(request.url);
		return (
			hostname === 'localhost' ||
			hostname === '127.0.0.1' ||
			hostname === '[::1]' ||
			hostname === '0.0.0.0'
		);
	} catch {
		return true;
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function edgeCacheGetSession(key: string, request: Request): Promise<any | null> {
	if (dev || isLocalHostname(request)) return null; // cache.match hangs in wrangler dev
	try {
		const cache = getEdgeCache();
		if (!cache) return null;
		const res = await cache.match(new Request(SESSION_CACHE_NS + encodeURIComponent(key)));
		if (!res) return null;
		return await res.json();
	} catch {
		return null;
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function edgeCachePutSession(key: string, session: any, request: Request): void {
	if (dev || isLocalHostname(request)) return;
	try {
		const cache = getEdgeCache();
		if (!cache) return;
		cache
			.put(
				new Request(SESSION_CACHE_NS + encodeURIComponent(key)),
				new Response(JSON.stringify(session), {
					headers: { 'content-type': 'application/json', 'cache-control': 'max-age=5' }
				})
			)
			.catch(() => {});
	} catch {
		/* Ignore errors — cache is best-effort */
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSessionWithCache(auth: any, request: Request): Promise<any> {
	if (isMutation(request.method)) {
		return auth.api.getSession({ headers: request.headers });
	}

	const cacheKey = getAuthCacheKey(request);
	if (!cacheKey) return null;

	const now = Date.now();
	const cached = sessionCache.get(cacheKey);

	if (cached && cached.expiresAt > now) {
		return cached.session;
	}

	// L2: cross-isolate edge cache — one HMAC verification populates cache for all isolates
	const edgeCached = await edgeCacheGetSession(cacheKey, request);
	if (edgeCached !== null) {
		sessionCache.set(cacheKey, { session: edgeCached, expiresAt: now + 5000 });
		return edgeCached;
	}

	const session = await auth.api.getSession({ headers: request.headers });
	sessionCache.set(cacheKey, {
		session,
		expiresAt: now + 5000
	});

	if (session !== null) {
		edgeCachePutSession(cacheKey, session, request);
	}

	// Periodically clean up cache entries to prevent memory growth
	if (sessionCache.size > 1000) {
		for (const [k, v] of sessionCache) {
			if (v.expiresAt <= now) {
				sessionCache.delete(k);
			}
		}
		if (sessionCache.size > 1000) {
			sessionCache.clear();
		}
	}

	return session;
}

export const handle: Handle = async ({ event, resolve }) => {
	const platform = event.platform;
	if (!platform) throw new Error('No platform - are you running with wrangler?');
	const db = platform.env.DB;

	const { pathname } = event.url;
	const method = event.request.method;

	// 静的アセット — 認証もDBも完全スキップ
	if (
		pathname.startsWith('/_app/immutable/') ||
		pathname === '/_app/version.json' ||
		pathname.startsWith('/favicon') ||
		pathname === '/robots.txt'
	) {
		const response = await resolve(event);
		response.headers.set('cache-control', 'public, max-age=31536000, immutable');
		return response;
	}

	// Auth インスタンスをキャッシュ（isolate 内で再利用）
	const env = platform.env;
	let auth = authCache.get(db);
	if (!auth) {
		auth = createAuth(db, { secret: env.BETTER_AUTH_SECRET, url: env.BETTER_AUTH_URL });
		authCache.set(db, auth);
	}
	event.locals.auth = auth;

	// BetterAuth API — mutation のみ rate limit
	if (pathname.startsWith('/api/auth')) {
		if (isMutation(method)) {
			const limited = await rateLimitOrNull(db, event.request, AUTH_RATE_LIMIT);
			if (limited) return limited;
		}
		return svelteKitHandler({ event, resolve, auth, building });
	}

	// 公開ページ — セッション確認不要、mutation のみ rate limit
	if (PUBLIC_PATHS.includes(pathname)) {
		if (isMutation(method)) {
			const limited = await rateLimitOrNull(db, event.request, AUTH_RATE_LIMIT);
			if (limited) return limited;
		}
		return svelteKitHandler({ event, resolve, auth, building });
	}

	// ここから先は認証必須
	const session = await getSessionWithCache(auth, event.request);

	if (!session) {
		if (pathname.startsWith('/_app/remote/') || pathname.startsWith('/api/')) {
			return new Response('Unauthorized', { status: 401 });
		}
		const redirectTo = `${pathname}${event.url.search}`;
		return new Response(null, {
			status: 303,
			headers: { location: `/auth/login?redirectTo=${encodeURIComponent(redirectTo)}` }
		});
	}

	event.locals.session = session.session;
	event.locals.user = session.user;

	// authProfile は必要な画面だけで取得
	if (PROFILE_PATHS.some((p) => pathname.startsWith(p))) {
		event.locals.authProfile = await getAuthProfile(session.user);
	}

	// mutation のみ D1 rate limit（GET は通す）
	if (isMutation(method) && pathname.startsWith('/api/')) {
		const limited = await rateLimitOrNull(db, event.request, API_RATE_LIMIT);
		if (limited) return limited;
	}

	const response = await svelteKitHandler({ event, resolve, auth, building });
	return response;
};

async function rateLimitOrNull(
	db: D1Database,
	request: Request,
	config: { maxTokens: number }
): Promise<Response | null> {
	const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
	const check = await checkRateLimit(db, ip, config);
	if (check.allowed) return null;
	return new Response('Too Many Requests', {
		status: 429,
		headers: { 'retry-after': String(Math.ceil(check.retryAfterMs / 1000)) }
	});
}
