import { renderPdfFromHtml } from './pdf';
import { renderScoresCsv } from './render/csv';
import { renderEmergencyHtml } from './render/html';
import { renderEmergencyMarkdown } from './render/markdown';
import { renderEventLogNdjson } from './render/ndjson';
import { buildEmergencyView, toSafeTimestamp } from './render/view';
import { collectSnapshot } from './snapshot';
import type { Env } from './types';

export const BACKUP_FILES = [
	'emergency.html',
	'emergency.pdf',
	'emergency.md',
	'state.json',
	'event-log.ndjson',
	'scores.csv'
] as const;

/** D1 が落ちていても download 側が対象大会を特定できるようにするポインタ */
export const CURRENT_TOURNAMENT_KEY = 'backups/current-tournament.txt';

export function latestPrefix(tournamentId: string): string {
	return `backups/${tournamentId}/latest`;
}

export function snapshotsPrefix(tournamentId: string): string {
	return `backups/${tournamentId}/snapshots`;
}

function putText(env: Env, key: string, body: string, contentType: string): Promise<R2Object> {
	return env.BACKUP_BUCKET.put(key, body, {
		httpMetadata: { contentType }
	});
}

export interface BackupResult {
	generatedAt: string;
	tournamentId: string;
	lastEventId: number;
	snapshotPath: string;
	pdfGenerated: boolean;
}

export async function generateEmergencyBackup(
	env: Env,
	options: { withPdf: boolean }
): Promise<BackupResult> {
	const snapshot = await collectSnapshot(env.DB, env.TOURNAMENT_ID || undefined);
	const view = buildEmergencyView(snapshot);

	const html = renderEmergencyHtml(view);
	const md = renderEmergencyMarkdown(view);
	const json = JSON.stringify(snapshot, null, 2);
	const csv = renderScoresCsv(view);
	const ndjson = renderEventLogNdjson(snapshot.recentEvents);

	const timestamp = toSafeTimestamp(snapshot.generatedAt);
	const base = `${snapshotsPrefix(snapshot.tournamentId)}/${timestamp}`;
	const latest = latestPrefix(snapshot.tournamentId);

	await Promise.all([
		putText(env, `${base}/emergency.html`, html, 'text/html; charset=utf-8'),
		putText(env, `${base}/emergency.md`, md, 'text/markdown; charset=utf-8'),
		putText(env, `${base}/state.json`, json, 'application/json; charset=utf-8'),
		putText(env, `${base}/scores.csv`, csv, 'text/csv; charset=utf-8'),
		putText(env, `${base}/event-log.ndjson`, ndjson, 'application/x-ndjson; charset=utf-8'),

		putText(env, `${latest}/emergency.html`, html, 'text/html; charset=utf-8'),
		putText(env, `${latest}/emergency.md`, md, 'text/markdown; charset=utf-8'),
		putText(env, `${latest}/state.json`, json, 'application/json; charset=utf-8'),
		putText(env, `${latest}/scores.csv`, csv, 'text/csv; charset=utf-8'),
		putText(env, `${latest}/event-log.ndjson`, ndjson, 'application/x-ndjson; charset=utf-8'),

		putText(env, CURRENT_TOURNAMENT_KEY, snapshot.tournamentId, 'text/plain; charset=utf-8')
	]);

	// PDF は補助ファイル。失敗してもバックアップ全体は成功扱いにする。
	let pdfGenerated = false;
	if (options.withPdf) {
		try {
			const pdf = await renderPdfFromHtml(env, html);
			await Promise.all([
				env.BACKUP_BUCKET.put(`${base}/emergency.pdf`, pdf, {
					httpMetadata: { contentType: 'application/pdf' }
				}),
				env.BACKUP_BUCKET.put(`${latest}/emergency.pdf`, pdf, {
					httpMetadata: { contentType: 'application/pdf' }
				})
			]);
			pdfGenerated = true;
		} catch (error) {
			console.error('PDF generation failed', error);
		}
	}

	const manifest = JSON.stringify(
		{
			generatedAt: snapshot.generatedAt,
			tournamentId: snapshot.tournamentId,
			tournamentName: snapshot.tournamentName,
			lastEventId: snapshot.lastEventId,
			pdfGenerated,
			files: [...BACKUP_FILES]
		},
		null,
		2
	);
	await Promise.all([
		putText(env, `${latest}/manifest.json`, manifest, 'application/json; charset=utf-8'),
		putText(env, `${base}/manifest.json`, manifest, 'application/json; charset=utf-8')
	]);

	return {
		generatedAt: snapshot.generatedAt,
		tournamentId: snapshot.tournamentId,
		lastEventId: snapshot.lastEventId,
		snapshotPath: base,
		pdfGenerated
	};
}
