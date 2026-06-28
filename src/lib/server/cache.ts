import { dev } from '$app/environment';
import { getRequestEvent } from '$app/server';
import * as v from 'valibot';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type CacheKeyPart = string | number | boolean | null | undefined;

type Schema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;
type InferSchemaOutput<TSchema extends Schema> = v.InferOutput<TSchema>;

type CacheHit<T> = { ok: true; hit: true; value: T; response: Response };
type CacheMiss = { ok: true; hit: false; value?: undefined; response?: undefined };
type CacheInvalid = {
	ok: false;
	hit: true;
	reason: 'invalid-json' | 'schema-mismatch';
	error: unknown;
	response: Response;
};

export type CacheGetResult<T> = CacheHit<T> | CacheMiss | CacheInvalid;

export type JsonCacheOptions<TSchema extends Schema> = {
	namespace: string;
	version?: string | number;
	schema: TSchema;
	ttlSeconds: number;
	pathPrefix?: string;
	tags?: string[];
	enabled?: boolean;
};

export type RememberOptions = {
	recomputeOnInvalid?: boolean;
	blockingPut?: boolean;
};

function getPlatformCache() {
	const event = getRequestEvent();
	const cacheStorage = event.platform?.caches as (CacheStorage & { default?: Cache }) | undefined;
	return {
		event,
		cache: cacheStorage?.default ?? null
	};
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

function stableStringify(value: unknown): string {
	if (value === null || typeof value !== 'object') {
		return JSON.stringify(value);
	}

	if (Array.isArray(value)) {
		return `[${value.map(stableStringify).join(',')}]`;
	}

	const obj = value as Record<string, unknown>;
	const keys = Object.keys(obj).sort();
	return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(',')}}`;
}

async function sha256Hex(input: string): Promise<string> {
	const bytes = new TextEncoder().encode(input);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeKeyPart(part: CacheKeyPart): string {
	if (part === undefined) return '_';
	if (part === null) return 'null';
	return String(part)
		.trim()
		.replace(/[^a-zA-Z0-9:_\-.]/g, '_')
		.slice(0, 120);
}

export async function buildCacheKey(input: {
	origin: string;
	namespace: string;
	version?: string | number;
	parts?: CacheKeyPart[];
	args?: unknown;
	pathPrefix?: string;
}): Promise<Request> {
	const url = new URL(input.origin);
	const prefix = input.pathPrefix ?? '/__cache';
	const version = input.version ?? 1;
	const readableParts = [
		normalizeKeyPart(input.namespace),
		`v${normalizeKeyPart(version)}`,
		...(input.parts ?? []).map(normalizeKeyPart)
	];

	let suffix = readableParts.join('/');
	if (input.args !== undefined) {
		const serialized = stableStringify(input.args);
		const hash = await sha256Hex(serialized);
		suffix += `/args-${hash}`;
	}

	url.pathname = `${prefix}/${suffix}`;
	url.search = '';

	return new Request(url.toString(), { method: 'GET' });
}

function jsonResponse(value: JsonValue, options: { ttlSeconds: number; tags?: string[] }) {
	const headers = new Headers({
		'content-type': 'application/json; charset=utf-8',
		'cache-control': `public, max-age=${options.ttlSeconds}`
	});

	if (options.tags?.length) {
		headers.set('cache-tag', options.tags.join(','));
	}

	return new Response(JSON.stringify(value), {
		status: 200,
		headers
	});
}

async function parseAndValidate<TSchema extends Schema>(
	response: Response,
	schema: TSchema
): Promise<CacheGetResult<InferSchemaOutput<TSchema>>> {
	let raw: unknown;
	try {
		raw = await response.clone().json();
	} catch (error) {
		return { ok: false, hit: true, reason: 'invalid-json', error, response };
	}

	const result = v.safeParse(schema, raw);
	if (!result.success) {
		return { ok: false, hit: true, reason: 'schema-mismatch', error: result.issues, response };
	}

	return { ok: true, hit: true, value: result.output, response };
}

export function createJsonCache<TSchema extends Schema>(options: JsonCacheOptions<TSchema>) {
	type Output = InferSchemaOutput<TSchema>;
	const enabled = options.enabled ?? true;

	async function key(input?: { parts?: CacheKeyPart[]; args?: unknown }) {
		const { event } = getPlatformCache();
		return buildCacheKey({
			origin: event.url.origin,
			namespace: options.namespace,
			version: options.version,
			parts: input?.parts,
			args: input?.args,
			pathPrefix: options.pathPrefix
		});
	}

	async function get(input?: {
		parts?: CacheKeyPart[];
		args?: unknown;
	}): Promise<CacheGetResult<Output>> {
		if (!enabled || dev || isLocalRequest()) {
			return { ok: true, hit: false };
		}

		const { cache } = getPlatformCache();
		if (!cache) {
			return { ok: true, hit: false };
		}

		const cacheKey = await key(input);
		const response = await cache.match(cacheKey);
		if (!response) {
			return { ok: true, hit: false };
		}

		return parseAndValidate(response, options.schema);
	}

	async function set(
		value: Output,
		input?: { parts?: CacheKeyPart[]; args?: unknown; blocking?: boolean }
	): Promise<void> {
		if (!enabled || dev || isLocalRequest()) return;

		const { event, cache } = getPlatformCache();
		if (!cache) return;

		const parsed = v.safeParse(options.schema, value);
		if (!parsed.success) {
			throw new Error(`Invalid cache value for namespace "${options.namespace}"`);
		}

		const cacheKey = await key(input);
		const response = jsonResponse(parsed.output as JsonValue, {
			ttlSeconds: options.ttlSeconds,
			tags: options.tags
		});

		const put = cache.put(cacheKey, response);
		if (input?.blocking) {
			await put;
		} else {
			event.platform?.ctx?.waitUntil?.(put);
		}
	}

	async function del(input?: { parts?: CacheKeyPart[]; args?: unknown }): Promise<boolean> {
		if (dev || isLocalRequest()) return false;

		const { cache } = getPlatformCache();
		if (!cache) return false;

		const cacheKey = await key(input);
		return cache.delete(cacheKey);
	}

	async function remember(
		input: { parts?: CacheKeyPart[]; args?: unknown },
		compute: () => Promise<Output>,
		rememberOptions?: RememberOptions
	): Promise<Output> {
		const recomputeOnInvalid = rememberOptions?.recomputeOnInvalid ?? true;
		const cached = await get(input);

		if (cached.ok && cached.hit) {
			return cached.value;
		}

		if (!cached.ok && !recomputeOnInvalid) {
			throw new Error(`Invalid cache entry for namespace "${options.namespace}": ${cached.reason}`);
		}

		const fresh = await compute();
		await set(fresh, { ...input, blocking: rememberOptions?.blockingPut });
		return fresh;
	}

	return {
		key,
		get,
		set,
		delete: del,
		remember
	};
}
