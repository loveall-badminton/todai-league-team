import { env } from '$env/dynamic/private';
import { command } from '$app/server';
import { requireAdmin } from '$lib/server/auth/access';
import { error } from '@sveltejs/kit';
import { fetchBackupWorker } from './backupClient.server';

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

	return (await response.json()) as {
		ok: boolean;
		generatedAt: string;
		lastEventId: number;
		pdfGenerated: boolean;
	};
});
