import { env } from '$env/dynamic/private';
import { command } from '$app/server';
import { requireAdmin } from '$lib/server/auth/access';
import { error } from '@sveltejs/kit';
import { fetchBackupWorker } from './backupClient.server';
import * as v from 'valibot';

const TriggerBackupResponseSchema = v.object({
	ok: v.boolean(),
	generatedAt: v.string(),
	lastEventId: v.number(),
	pdfGenerated: v.boolean()
});

export const triggerBackup = command(async () => {
	requireAdmin();

	if (!env.BACKUP_SECRET) {
		error(500, 'バックアップWorkerが設定されていません (BACKUP_SECRET)');
	}

	let response: Response;
	try {
		response = await fetchBackupWorker('/backup-now', {
			method: 'POST',
			headers: { authorization: `Bearer ${env.BACKUP_SECRET}` },
			signal: AbortSignal.timeout(60_000)
		});
	} catch (err) {
		error(502, `バックアップWorkerに接続できません: ${err instanceof Error ? err.message : err}`);
	}

	if (!response.ok) {
		error(502, `バックアップ生成に失敗しました (HTTP ${response.status})`);
	}

	const parsed = v.safeParse(TriggerBackupResponseSchema, await response.json());
	if (!parsed.success) {
		error(502, 'バックアップWorkerから予期しない応答を受け取りました');
	}
	return parsed.output;
});
