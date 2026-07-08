import { env } from '$env/dynamic/private';

/**
 * backup worker への fetch。
 * backup Worker は main Worker と独立運用するため、Service Binding ではなく
 * BACKUP_WORKER_URL の公開エンドポイントへ token 付きで接続する。
 */
export function fetchBackupWorker(path: string, init?: RequestInit): Promise<Response> {
	if (!env.BACKUP_WORKER_URL) {
		throw new Error('BACKUP_WORKER_URL is not configured');
	}
	return fetch(`${env.BACKUP_WORKER_URL}${path}`, init);
}
