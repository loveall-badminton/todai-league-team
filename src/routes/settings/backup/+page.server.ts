import { env } from '$env/dynamic/private';
import { requireAdmin } from '$lib/server/auth/access';
import { fetchBackupWorker } from './backupClient.server';
import type { PageServerLoad } from './$types';
import * as v from 'valibot';

const BackupManifestSchema = v.object({
	generatedAt: v.string(),
	tournamentId: v.string(),
	tournamentName: v.optional(v.string()),
	lastEventId: v.number(),
	pdfGenerated: v.optional(v.boolean()),
	files: v.array(v.string())
});
type BackupManifest = v.InferOutput<typeof BackupManifestSchema>;

const SnapshotsResponseSchema = v.object({
	snapshots: v.array(v.string())
});

async function fetchJson<T>(path: string, schema: v.GenericSchema<unknown, T>): Promise<T | null> {
	try {
		const res = await fetchBackupWorker(path, { signal: AbortSignal.timeout(5000) });
		if (!res.ok) return null;
		const parsed = v.safeParse(schema, await res.json());
		return parsed.success ? parsed.output : null;
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
			fetchJson(`/manifest.json${tokenQuery}`, BackupManifestSchema),
			fetchJson(`/snapshots${tokenQuery}`, SnapshotsResponseSchema)
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
