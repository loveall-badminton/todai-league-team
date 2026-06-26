import { dev } from '$app/environment';

type TokenBucket = {
	tokens: number;
	maxTokens: number;
	refillRate: number;
	lastRefill: number;
};

const RATE_LIMIT_MAX_TOKENS = 60;
const RATE_LIMIT_REFILL_RATE = 60 / 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

const AUTH_RATE_LIMIT_MAX_TOKENS = 10;
const AUTH_RATE_LIMIT_REFILL_RATE = 10 / 60;

const ipBuckets = new Map<string, TokenBucket>();

let lastCleanup = Date.now();

function cleanupExpiredBuckets(now: number) {
	const elapsed = now - lastCleanup;
	if (elapsed < 60_000) return;
	lastCleanup = now;

	const expiry = now - RATE_LIMIT_WINDOW_MS * 2;
	for (const [key, bucket] of ipBuckets) {
		if (bucket.lastRefill < expiry) ipBuckets.delete(key);
	}
}

function refillAndConsume(bucket: TokenBucket, now: number, cost: number): boolean {
	const elapsed = (now - bucket.lastRefill) / 1000;
	bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + elapsed * bucket.refillRate);
	bucket.lastRefill = now;

	if (bucket.tokens >= cost) {
		bucket.tokens -= cost;
		return true;
	}
	return false;
}

function getOrCreateBucket(
	map: Map<string, TokenBucket>,
	key: string,
	now: number,
	maxTokens: number,
	refillRate: number
): TokenBucket {
	const existing = map.get(key);
	if (existing) return existing;
	const bucket: TokenBucket = { tokens: maxTokens, maxTokens, refillRate, lastRefill: now };
	map.set(key, bucket);
	return bucket;
}

export type RateLimitCheck = {
	allowed: boolean;
	retryAfterMs: number;
};

export type RateLimitConfig = {
	maxTokens: number;
	refillRate: number;
	cost?: number;
};

export const API_RATE_LIMIT: RateLimitConfig = {
	maxTokens: RATE_LIMIT_MAX_TOKENS,
	refillRate: RATE_LIMIT_REFILL_RATE
};

export const AUTH_RATE_LIMIT: RateLimitConfig = {
	maxTokens: AUTH_RATE_LIMIT_MAX_TOKENS,
	refillRate: AUTH_RATE_LIMIT_REFILL_RATE
};

export function checkRateLimit(
	key: string,
	config: RateLimitConfig = API_RATE_LIMIT
): RateLimitCheck {
	if (dev) return { allowed: true, retryAfterMs: 0 };

	const { maxTokens, refillRate, cost = 1 } = config;
	const now = Date.now();
	cleanupExpiredBuckets(now);

	const bucket = getOrCreateBucket(ipBuckets, key, now, maxTokens, refillRate);
	if (!refillAndConsume(bucket, now, cost)) {
		const waitMs = Math.ceil(((cost - bucket.tokens) / refillRate) * 1000);
		return { allowed: false, retryAfterMs: Math.max(waitMs, 1000) };
	}

	return { allowed: true, retryAfterMs: 0 };
}

export { RATE_LIMIT_WINDOW_MS };
