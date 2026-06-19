import * as schema from '$lib/server/db/schema';
import { drizzle } from 'drizzle-orm/d1';

export type CfTestDb = ReturnType<typeof createCfTestDb>;

const migrationModules = import.meta.glob('/drizzle/*.sql', { eager: true, query: '?raw' });

const migrationSql = Object.keys(migrationModules)
	.sort()
	.map((k) => (migrationModules[k] as { default: string }).default)
	.join('\n')
	.replace(/--> statement-breakpoint/g, ';');

export function createCfTestDb(d1: D1Database) {
	const db = drizzle(d1, { schema });

	let migrated = false;

	async function ensureMigrated() {
		if (migrated) return;
		if (migrationSql) {
			const statements = migrationSql
				.split(';')
				.map((s) => s.trim())
				.filter((s) => s.length > 0);
			for (const statement of statements) {
				await d1.prepare(statement).run();
			}
		}
		migrated = true;
	}

	async function reset() {
		await ensureMigrated();
		const tables = await d1
			.prepare(
				"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf%' AND name != 'sqlite_sequence'"
			)
			.all();
		const names = tables.results.map((r) => (r as { name: string }).name);
		for (const name of names) {
			await d1.prepare(`DELETE FROM ${name}`).run();
		}
	}

	return { db, reset };
}
