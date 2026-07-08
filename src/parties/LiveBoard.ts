import { Server, type Connection } from 'partyserver';
import { liveMessageSchema, type LiveMessage } from '$lib/realtime/channels';
import * as v from 'valibot';

const ALLOWED_INTERNAL_HOST = 'live-board.internal';

// 汎用エントリキャッシュ(グローバル L2)。エッジキャッシュ(PoP ローカル)のミス時に
// ここを参照することで、D1 への再計算を「PoP 数 × TTL」から「失効イベントごとに1回」に抑える。
// broadcast(スコア更新等)の topics と交差するエントリは即時失効する。
const CACHE_ENTRY_PREFIX = 'cache-entry:';
const CACHE_EPOCH_KEY = 'cache-entry-epoch';
const CacheEntryPutSchema = v.object({
	key: v.pipe(v.string(), v.nonEmpty()),
	data: v.unknown(),
	ttlMs: v.pipe(v.number(), v.minValue(1_000), v.maxValue(300_000)),
	topics: v.array(v.string()),
	// GET 時点の epoch。その後に失効が走っていたら PUT を拒否し、古い計算結果の混入を防ぐ
	epoch: v.optional(v.number())
});

type GenericCacheEntry = { data: unknown; expiresAt: number; topics: string[] };

export class LiveBoard extends Server<Env> {
	static options = { hibernate: true };

	// hibernation でメモリが消えても storage から復元できるホットキャッシュ
	private entryCache = new Map<string, GenericCacheEntry>();
	private entryEpoch: number | null = null;

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

		if (url.pathname === '/cache/entry') {
			if (request.method === 'GET') return this.handleEntryGet(url);
			if (request.method === 'PUT') return this.handleEntryPut(request);
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
			// 更新ブロードキャストと同時に、関係するキャッシュエントリをグローバルに失効させる。
			// クライアントはこのメッセージを受けて即再取得するため、broadcast 前に完了させる。
			if (parsed.output.type === 'updated') {
				await this.invalidateEntriesByTopics(parsed.output.topics);
			}
			this.broadcast(JSON.stringify(parsed.output));
			return Response.json({ ok: true });
		}
		return new Response('Not found', { status: 404 });
	}

	private async getEpoch(): Promise<number> {
		if (this.entryEpoch === null) {
			this.entryEpoch = (await this.ctx.storage.get<number>(CACHE_EPOCH_KEY)) ?? 0;
		}
		return this.entryEpoch;
	}

	private async handleEntryGet(url: URL): Promise<Response> {
		const key = url.searchParams.get('key');
		if (!key) return Response.json({ ok: false, error: 'key required' }, { status: 400 });

		const now = Date.now();
		const epoch = await this.getEpoch();
		let entry = this.entryCache.get(key) ?? null;
		if (!entry) {
			entry = (await this.ctx.storage.get<GenericCacheEntry>(CACHE_ENTRY_PREFIX + key)) ?? null;
			if (entry) this.entryCache.set(key, entry);
		}

		if (!entry || entry.expiresAt <= now) {
			if (entry) {
				this.entryCache.delete(key);
				void this.ctx.storage.delete(CACHE_ENTRY_PREFIX + key).catch(() => {});
			}
			return Response.json({ ok: false, epoch }, { status: 404 });
		}

		return Response.json({ ok: true, data: entry.data, epoch });
	}

	private async handleEntryPut(request: Request): Promise<Response> {
		let raw: unknown;
		try {
			raw = await request.json();
		} catch {
			return Response.json({ ok: false, error: 'invalid json' }, { status: 400 });
		}
		const parsed = v.safeParse(CacheEntryPutSchema, raw);
		if (!parsed.success) {
			return Response.json({ ok: false, error: 'invalid payload' }, { status: 400 });
		}

		if (parsed.output.epoch !== undefined && parsed.output.epoch !== (await this.getEpoch())) {
			// 計算開始後に失効が走った(=計算結果が古い可能性がある)ため受け入れない
			return Response.json({ ok: false, error: 'stale epoch' }, { status: 409 });
		}

		const entry: GenericCacheEntry = {
			data: parsed.output.data,
			expiresAt: Date.now() + parsed.output.ttlMs,
			topics: parsed.output.topics
		};
		this.entryCache.set(parsed.output.key, entry);
		void this.ctx.storage.put(CACHE_ENTRY_PREFIX + parsed.output.key, entry).catch(() => {});
		return Response.json({ ok: true });
	}

	private async invalidateEntriesByTopics(topics: readonly string[]): Promise<void> {
		if (topics.length === 0) return;

		// epoch を進めるだけで DO storage 上のエントリは物理削除しない。
		// handleEntryPut が epoch を検証するため、古い epoch で書き込まれた
		// エントリは DO 層で拒否される。storage.list の prefix scan は
		// エントリ数に比例してコストが増大するため、スコア更新（高頻度）の
		// パスでは実行しない。エントリは TTL により自然期限切れする。
		this.entryEpoch = (await this.getEpoch()) + 1;
		void this.ctx.storage.put(CACHE_EPOCH_KEY, this.entryEpoch).catch(() => {});

		const topicSet = new Set(topics);
		const matches = (entry: GenericCacheEntry) => entry.topics.some((t) => topicSet.has(t));

		for (const [key, entry] of this.entryCache) {
			if (matches(entry)) this.entryCache.delete(key);
		}
	}

	async onClose() {
		// no-op
	}

	async onError() {
		// no-op
	}
}
