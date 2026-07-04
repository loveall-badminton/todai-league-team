import { env } from '$env/dynamic/private';
import { requireAdmin } from '$lib/server/auth/access';
import { fetchBackupWorker } from './backupClient.server';
import type { PageServerLoad } from './$types';

interface BackupManifest {
	generatedAt: string;
	tournamentId: string;
	tournamentName?: string;
	lastEventId: number;
	pdfGenerated?: boolean;
	files: string[];
}

async function fetchJson<T>(path: string): Promise<T | null> {
	try {
		const res = await fetchBackupWorker(path, { signal: AbortSignal.timeout(5000) });
		if (!res.ok) return null;
		return (await res.json()) as T;
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async () => {
	requireAdmin();

	const workerUrl = env.BACKUP_WORKER_URL ?? '';
	const token = env.BACKUP_DOWNLOAD_TOKEN ?? '';
	const configured = Boolean(workerUrl && token);

	let manifest: BackupManifest | null = null;
	let snapshots: string[] = [];

	if (configured) {
		const tokenQuery = `?token=${encodeURIComponent(token)}`;
		const [manifestResult, snapshotsResult] = await Promise.all([
			fetchJson<BackupManifest>(`/manifest.json${tokenQuery}`),
			fetchJson<{ snapshots: string[] }>(`/snapshots${tokenQuery}`)
		]);
		manifest = manifestResult;
		snapshots = snapshotsResult?.snapshots?.slice(0, 30) ?? [];
	}

	return {
		configured,
		workerUrl,
		token,
		manifest,
		snapshots
	};
};
