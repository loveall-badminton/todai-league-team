import { dev } from '$app/environment';
import { getDb } from '$lib/server/db';
import { rateLimits } from '$lib/server/db/schema';
import { and, eq, sql } from 'drizzle-orm';

export type RateLimitCheck = {
	allowed: boolean;
	retryAfterMs: number;
};

export type RateLimitConfig = {
	maxTokens: number;
	cost?: number;
};

export const API_RATE_LIMIT: RateLimitConfig = {
	maxTokens: 60
};

export const AUTH_RATE_LIMIT: RateLimitConfig = {
	maxTokens: 10
};

const WINDOW_MS = 60_000;

export async function checkRateLimit(
	db: D1Database,
	key: string,
	config: RateLimitConfig = API_RATE_LIMIT
): Promise<RateLimitCheck> {
	if (dev) return { allowed: true, retryAfterMs: 0 };

	const { maxTokens, cost = 1 } = config;
	const now = Date.now();
	const windowStart = Math.floor(now / WINDOW_MS);
	const nowISO = new Date(now).toISOString();

	const drizzle = getDb(db);

	const row = await drizzle
		.select({ count: rateLimits.count })
		.from(rateLimits)
		.where(and(eq(rateLimits.key, key), eq(rateLimits.windowStart, windowStart)))
		.get();

	const currentCount = row?.count ?? 0;

	if (currentCount + cost > maxTokens) {
		const retryAfter = (windowStart + 1) * WINDOW_MS - now;
		return { allowed: false, retryAfterMs: Math.max(retryAfter, 1000) };
	}

	await drizzle.run(sql`
		INSERT INTO rate_limits (key, window_start_seconds, count, created_at, updated_at)
		VALUES (${key}, ${windowStart}, ${cost}, ${nowISO}, ${nowISO})
		ON CONFLICT(key, window_start_seconds) DO UPDATE SET
			count = count + ${cost},
			updated_at = ${nowISO}
	`);

	return { allowed: true, retryAfterMs: 0 };
}
