import * as schema from '$lib/server/db/schema';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type TestDb = ReturnType<typeof createTestDb>;

export function createTestDb() {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');

	for (const file of readdirSync('drizzle')
		.filter((name) => name.endsWith('.sql'))
		.sort()) {
		const sql = readFileSync(join('drizzle', file), 'utf8');
		for (const statement of sql.split('--> statement-breakpoint')) {
			const trimmed = statement.trim();
			if (trimmed) sqlite.exec(trimmed);
		}
	}

	const db = drizzle(sqlite, { schema });
	Object.assign(db, {
		batch: async (queries: unknown[]) => {
			const results: unknown[] = [];
			sqlite.transaction(() => {
				for (const query of queries) {
					results.push((query as { run: () => unknown }).run());
				}
			})();
			return results;
		}
	});

	return {
		db: db as typeof db & { batch: (queries: unknown[]) => Promise<unknown[]> },
		sqlite,
		close: () => sqlite.close()
	};
}
