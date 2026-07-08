import type { Handle } from '@sveltejs/kit';
import { building, dev } from '$app/environment';
import { createJsonCache } from '$lib/server/cache';
import { createAuth } from '$lib/server/auth';
import { getAuthProfile } from '$lib/server/auth/access';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { checkRateLimit, API_RATE_LIMIT, AUTH_RATE_LIMIT } from '$lib/server/ratelimit';
import * as v from 'valibot';

const PUBLIC_PATHS = ['/auth/login', '/auth/bootstrap'];
const PROFILE_PATHS = ['/admin', '/ties', '/scores', '/referee', '/live'];

const authCache = new WeakMap<D1Database, Map<string, ReturnType<typeof createAuth>>>();
type Auth = ReturnType<typeof createAuth>;
type SessionResult = Awaited<ReturnType<Auth['api']['getSession']>>;
type NonNullSessionResult = NonNullable<SessionResult>;
type CachedSessionShape = v.InferOutput<typeof SessionCacheSchema>;
type AuthEnv = Env & {
	BETTER_AUTH_SECRET?: string;
	BETTER_AUTH_URL?: string;
};

function isMutation(method: string) {
	return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
}

interface SessionCacheEntry {
	session: SessionResult;
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

function getAuthOrigin(eventUrl: URL, env: AuthEnv): string {
	const configured = env.BETTER_AUTH_URL?.trim();
	return configured || eventUrl.origin;
}

function getAuthSecret(env: AuthEnv): string {
	const secret = env.BETTER_AUTH_SECRET?.trim();
	if (!secret) {
		throw new Error('BETTER_AUTH_SECRET is not configured');
	}
	return secret;
}

// Cross-isolate session cache using CF Edge Cache (shared per datacenter, avoids HMAC re-verification)
// 60s TTL: BetterAuth のセッションは HMAC 検証済みかつ改ざん不可なので長期キャッシュしても安全。
// これにより同一ユーザーの連続リクエストでの D1 読み取りを約 90% 削減。
const SESSION_TTL_MS = 60_000;
const SessionCacheSchema = v.object({
	session: v.object({
		id: v.string(),
		createdAt: v.union([v.string(), v.date()]),
		updatedAt: v.union([v.string(), v.date()]),
		userId: v.string(),
		expiresAt: v.union([v.string(), v.date()]),
		token: v.string(),
		ipAddress: v.optional(v.nullable(v.string())),
		userAgent: v.optional(v.nullable(v.string())),
		impersonatedBy: v.optional(v.nullable(v.string()))
	}),
	user: v.objectWithRest(
		{
			id: v.string(),
			email: v.string(),
			name: v.string(),
			createdAt: v.union([v.string(), v.date()]),
			updatedAt: v.union([v.string(), v.date()]),
			emailVerified: v.boolean(),
			image: v.optional(v.nullable(v.string())),
			username: v.optional(v.nullable(v.string())),
			displayUsername: v.optional(v.nullable(v.string())),
			banned: v.optional(v.nullable(v.boolean())),
			role: v.optional(v.nullable(v.string())),
			banReason: v.optional(v.nullable(v.string())),
			banExpires: v.optional(v.nullable(v.union([v.string(), v.date()])))
		},
		v.unknown()
	)
});

function toDate(value: string | Date): Date {
	return value instanceof Date ? value : new Date(value);
}

function normalizeCachedSession(value: CachedSessionShape): NonNullSessionResult {
	return {
		session: {
			...value.session,
			createdAt: toDate(value.session.createdAt),
			updatedAt: toDate(value.session.updatedAt),
			expiresAt: toDate(value.session.expiresAt)
		},
		user: {
			...value.user,
			createdAt: toDate(value.user.createdAt),
			updatedAt: toDate(value.user.updatedAt),
			banned: value.user.banned ?? null,
			banExpires:
				value.user.banExpires == null ||
				(typeof value.user.banExpires === 'object' &&
					Object.keys(value.user.banExpires).length === 0)
					? value.user.banExpires
					: toDate(value.user.banExpires)
		}
	};
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

async function edgeCacheGetSession(key: string, request: Request): Promise<SessionResult> {
	if (dev || isLocalHostname(request)) return null; // cache.match hangs in wrangler dev
	try {
		const cache = createJsonCache({
			namespace: 'auth-session',
			version: 1,
			schema: SessionCacheSchema,
			ttlSeconds: 60,
			pathPrefix: '/__auth-cache'
		});
		const res = await cache.get({ parts: [key] });
		if (!res.ok || !res.hit) return null;
		return normalizeCachedSession(res.value);
	} catch {
		return null;
	}
}

function edgeCachePutSession(key: string, session: NonNullSessionResult, request: Request): void {
	if (dev || isLocalHostname(request)) return;
	try {
		const cache = createJsonCache({
			namespace: 'auth-session',
			version: 1,
			schema: SessionCacheSchema,
			ttlSeconds: 60,
			pathPrefix: '/__auth-cache'
		});
		void cache.set(session, { parts: [key] }).catch(() => {});
	} catch {
		/* Ignore errors — cache is best-effort */
	}
}

async function getSessionWithCache(auth: Auth, request: Request): Promise<SessionResult> {
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
		sessionCache.set(cacheKey, { session: edgeCached, expiresAt: now + SESSION_TTL_MS });
		return edgeCached;
	}

	const session = await auth.api.getSession({ headers: request.headers });
	sessionCache.set(cacheKey, {
		session,
		expiresAt: now + SESSION_TTL_MS
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
		pathname.startsWith('/favicon') ||
		pathname === '/robots.txt'
	) {
		const response = await resolve(event);
		response.headers.set('cache-control', 'public, max-age=31536000, immutable');
		return response;
	}
	if (pathname === '/_app/version.json') {
		const response = await resolve(event);
		response.headers.set('cache-control', 'public, max-age=300, stale-while-revalidate=600');
		return response;
	}

	// Auth インスタンスをキャッシュ（isolate 内で再利用）
	const env = platform.env as AuthEnv;
	const authOrigin = getAuthOrigin(event.url, env);
	const authSecret = getAuthSecret(env);
	let authByOrigin = authCache.get(db);
	if (!authByOrigin) {
		authByOrigin = new Map();
		authCache.set(db, authByOrigin);
	}
	let auth = authByOrigin.get(authOrigin);
	if (!auth) {
		auth = createAuth(db, { secret: authSecret, url: authOrigin });
		authByOrigin.set(authOrigin, auth);
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

	// SSR edge caching: SPA shell (ssr=false) は全ユーザー同一のため短時間のエッジキャッシュが有効。
	// ライブボードなど読み取り専用ページの D1 負荷を低減する。
	if (method === 'GET' && response.status < 400 && !response.headers.has('cache-control')) {
		if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
			response.headers.set('cache-control', 'public, s-maxage=10, stale-while-revalidate=30');
		} else if (pathname.startsWith('/live')) {
			response.headers.set('cache-control', 'public, s-maxage=5, stale-while-revalidate=15');
		}
	}
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
