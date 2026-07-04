import { Hono } from 'hono';
import {
	CURRENT_TOURNAMENT_KEY,
	generateEmergencyBackup,
	latestPrefix,
	snapshotsPrefix
} from './backup';
import type { Env } from './types';

const DOWNLOADABLE_FILES: Record<string, { contentType: string; disposition: string }> = {
	'emergency.html': {
		contentType: 'text/html; charset=utf-8',
		disposition: 'inline'
	},
	'emergency.pdf': {
		contentType: 'application/pdf',
		disposition: 'inline; filename="emergency.pdf"'
	},
	'emergency.md': {
		contentType: 'text/markdown; charset=utf-8',
		disposition: 'inline'
	},
	'scores.csv': {
		contentType: 'text/csv; charset=utf-8',
		disposition: 'attachment; filename="scores.csv"'
	},
	'state.json': {
		contentType: 'application/json; charset=utf-8',
		disposition: 'attachment; filename="state.json"'
	},
	'event-log.ndjson': {
		contentType: 'application/x-ndjson; charset=utf-8',
		disposition: 'attachment; filename="event-log.ndjson"'
	},
	'manifest.json': {
		contentType: 'application/json; charset=utf-8',
		disposition: 'inline'
	}
};

/** D1 に依存せず対象大会を特定する (障害時でも download を動かすため) */
async function resolveTournamentIdForDownload(env: Env): Promise<string | null> {
	if (env.TOURNAMENT_ID) return env.TOURNAMENT_ID;
	const pointer = await env.BACKUP_BUCKET.get(CURRENT_TOURNAMENT_KEY);
	if (!pointer) return null;
	return (await pointer.text()).trim() || null;
}

const app = new Hono<{ Bindings: Env }>();

function timingSafeEqual(a: string, b: string): boolean {
	const encoder = new TextEncoder();
	const bufA = encoder.encode(a);
	const bufB = encoder.encode(b);
	if (bufA.byteLength !== bufB.byteLength) return false;
	return crypto.subtle.timingSafeEqual(bufA, bufB);
}

// ダウンロード系: ?token=<DOWNLOAD_TOKEN> による簡易認証
app.use('*', async (c, next) => {
	if (c.req.method === 'POST') return next();
	const token = c.req.query('token') ?? '';
	if (!c.env.DOWNLOAD_TOKEN || !timingSafeEqual(token, c.env.DOWNLOAD_TOKEN)) {
		return c.text('Unauthorized', 401);
	}
	return next();
});

app.post('/backup-now', async (c) => {
	const auth = c.req.header('authorization') ?? '';
	if (!c.env.BACKUP_SECRET || !timingSafeEqual(auth, `Bearer ${c.env.BACKUP_SECRET}`)) {
		return c.text('Unauthorized', 401);
	}
	try {
		const result = await generateEmergencyBackup(c.env, { withPdf: true });
		return c.json({ ok: true, ...result });
	} catch (error) {
		console.error('manual backup failed', error);
		return c.json({ ok: false, error: String(error) }, 500);
	}
});

// バックアップ生成履歴 (snapshots/ のプレフィックス一覧)
app.get('/snapshots', async (c) => {
	const tournamentId = await resolveTournamentIdForDownload(c.env);
	if (!tournamentId) return c.json({ ok: false, error: 'no backup yet' }, 404);

	const listed = await c.env.BACKUP_BUCKET.list({
		prefix: `${snapshotsPrefix(tournamentId)}/`,
		delimiter: '/'
	});
	const timestamps = (listed.delimitedPrefixes ?? [])
		.map((p) => p.split('/').at(-2) ?? '')
		.filter(Boolean)
		.sort()
		.reverse();
	return c.json({ ok: true, tournamentId, snapshots: timestamps });
});

// 最新ファイルの配信: /emergency.html?token=... など
// ?snapshot=<timestamp> を付けると snapshots/ 配下の履歴版を取得できる
app.get('/:file', async (c) => {
	const file = c.req.param('file');
	const meta = DOWNLOADABLE_FILES[file];
	if (!meta) return c.text('Not found', 404);

	const tournamentId = await resolveTournamentIdForDownload(c.env);
	if (!tournamentId) return c.text('Backup not found', 404);

	const snapshot = c.req.query('snapshot');
	const dir = snapshot
		? `${snapshotsPrefix(tournamentId)}/${snapshot}`
		: latestPrefix(tournamentId);

	const object = await c.env.BACKUP_BUCKET.get(`${dir}/${file}`);
	if (!object) return c.text('Backup not found', 404);

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set('etag', object.httpEtag);
	headers.set('cache-control', 'no-store');
	headers.set('content-type', meta.contentType);
	headers.set('content-disposition', meta.disposition);

	return new Response(object.body, { headers });
});

export default {
	fetch: app.fetch,

	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
		// */30 の実行時のみ PDF も生成する (Browser Run のブラウザ時間を節約するため)
		const withPdf = controller.cron === '*/30 * * * *';
		ctx.waitUntil(
			generateEmergencyBackup(env, { withPdf }).catch((error) => {
				console.error('scheduled backup failed', error);
			})
		);
	}
} satisfies ExportedHandler<Env>;
