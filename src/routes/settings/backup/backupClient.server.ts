import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';

/**
 * backup worker への fetch。
 * 本番は Service Binding (BACKUP_WORKER) 経由で呼ぶ。workers.dev の公開URLへの
 * Worker 間サブリクエストは失敗するため。ローカル開発 (vite dev) など binding が
 * 無い環境では BACKUP_WORKER_URL への通常 fetch にフォールバックする。
 */
export function fetchBackupWorker(path: string, init?: RequestInit): Promise<Response> {
	const platform = getRequestEvent().platform as { env?: { BACKUP_WORKER?: Fetcher } } | undefined;
	const binding = platform?.env?.BACKUP_WORKER;
	if (binding) {
		// binding 経由ではホスト名は使われないが、URL は絶対URLである必要がある
		return binding.fetch(`https://backup-worker${path}`, init);
	}
	if (!env.BACKUP_WORKER_URL) {
		throw new Error('BACKUP_WORKER_URL is not configured');
	}
	return fetch(`${env.BACKUP_WORKER_URL}${path}`, init);
}
