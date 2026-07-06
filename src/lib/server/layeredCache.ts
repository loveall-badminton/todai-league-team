import { getRequestEvent } from '$app/server';
import * as v from 'valibot';
import { LIVE_BOARD_CHANNEL, type LiveTopic } from '$lib/realtime/channels';
import {
	createJsonCache,
	type CacheKeyPart,
	type JsonCacheOptions,
	type TtlSecondsFor
} from './cache';

/**
 * エッジキャッシュ(PoP ローカル・TTL)の上に LiveBoard DO の
 * グローバルエントリキャッシュ(L2)を重ねた2層キャッシュ。
 *
 * - 読み込み: エッジ → DO → compute(D1)
 * - 書き込み: compute 結果を DO(waitUntil)とエッジの両方へ
 * - 失効: notifyLiveBoard 等のブロードキャストが DO を通過する際、
 *   invalidateOn と交差するトピックのエントリが DO 側で即時削除される
 *
 * エッジ層のミスは PoP ごとに独立して起きるが、DO 層が吸収するため
 * D1 への再計算は「失効イベント後の最初の1リクエスト」だけになる。
 * エッジ層の staleness は従来どおり ttlSeconds が上限。
 */

const DO_ENTRY_URL = 'https://live-board.internal/cache/entry';
const DEFAULT_DO_TTL_MS = 30_000;

type Schema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;

export type LayeredJsonCacheOptions<TSchema extends Schema> = JsonCacheOptions<TSchema> & {
	/** これらのトピックのブロードキャストで DO 層のエントリを失効させる */
	invalidateOn: readonly LiveTopic[];
	/** DO 層エントリの保持上限(失効イベントが来ない場合の安全弁) */
	doTtlMs?: number;
};

const DoEntryHitSchema = v.object({
	ok: v.literal(true),
	data: v.unknown(),
	epoch: v.number()
});

const DoEntryMissSchema = v.object({
	ok: v.literal(false),
	epoch: v.number()
});

export function createLayeredJsonCache<TSchema extends Schema>(
	options: LayeredJsonCacheOptions<TSchema>
) {
	type Output = v.InferOutput<TSchema>;
	const edge = createJsonCache(options);
	const doTtlMs = options.doTtlMs ?? DEFAULT_DO_TTL_MS;

	function getLiveBoardStub() {
		try {
			const namespace = getRequestEvent().platform?.env?.LiveBoard;
			return namespace ? namespace.getByName(LIVE_BOARD_CHANNEL) : null;
		} catch {
			return null;
		}
	}

	type CacheInput = { parts?: CacheKeyPart[]; args?: unknown };

	async function entryKey(input: CacheInput): Promise<string> {
		const request = await edge.key(input);
		return new URL(request.url).pathname;
	}

	type DoGetResult =
		| { hit: true; value: Output; epoch: number }
		| { hit: false; epoch: number }
		| { hit: false; epoch: null };

	async function getFromDo(key: string): Promise<DoGetResult> {
		const stub = getLiveBoardStub();
		if (!stub) return { hit: false, epoch: null };
		try {
			const res = await stub.fetch(`${DO_ENTRY_URL}?key=${encodeURIComponent(key)}`);
			const raw = await res.json();
			if (!res.ok) {
				const miss = v.safeParse(DoEntryMissSchema, raw);
				return { hit: false, epoch: miss.success ? miss.output.epoch : null };
			}
			const body = v.safeParse(DoEntryHitSchema, raw);
			if (!body.success) return { hit: false, epoch: null };
			const value = v.safeParse(options.schema, body.output.data);
			return value.success
				? { hit: true, value: value.output, epoch: body.output.epoch }
				: { hit: false, epoch: body.output.epoch };
		} catch {
			return { hit: false, epoch: null };
		}
	}

	// DO 層エントリ TTL のスキーマ上限(LiveBoard 側 CacheEntryPutSchema の maxValue)
	const DO_TTL_MAX_MS = 300_000;

	// epoch は GET 時点のものを渡す。計算中に失効が走っていた場合 DO 側が PUT を拒否する
	function putToDo(key: string, value: Output, epoch: number, ttlMs: number): void {
		const stub = getLiveBoardStub();
		if (!stub) return;
		try {
			const task = stub
				.fetch(DO_ENTRY_URL, {
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						key,
						data: value,
						ttlMs,
						topics: [...options.invalidateOn],
						epoch
					})
				})
				.then(() => undefined)
				.catch(() => undefined);
			try {
				getRequestEvent().platform?.ctx?.waitUntil?.(task);
			} catch {
				// リクエストコンテキスト外(テスト等)— best-effort のまま流す
			}
		} catch {
			// DO 層への書き込みは best-effort
		}
	}

	async function remember(
		input: CacheInput,
		compute: () => Promise<Output>,
		rememberOptions?: { ttlSecondsFor?: TtlSecondsFor<Output> }
	): Promise<Output> {
		const cached = await edge.get(input);
		if (cached.ok && cached.hit) return cached.value;

		const ttlFor = (value: Output) => rememberOptions?.ttlSecondsFor?.(value);

		const key = await entryKey(input);
		const fromDo = await getFromDo(key);
		if (fromDo.hit) {
			await edge.set(fromDo.value, { ...input, ttlSeconds: ttlFor(fromDo.value) });
			return fromDo.value;
		}

		const fresh = await compute();
		const ttlSeconds = ttlFor(fresh);
		// epoch が取れなかった場合(DO 不達など)は古さを検証できないため DO には書かない
		if (fromDo.epoch !== null) {
			const doTtl = ttlSeconds !== undefined ? Math.min(ttlSeconds * 1000, DO_TTL_MAX_MS) : doTtlMs;
			putToDo(key, fresh, fromDo.epoch, doTtl);
		}
		await edge.set(fresh, { ...input, ttlSeconds });
		return fresh;
	}

	return { ...edge, remember };
}
