/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { env } from 'cloudflare:workers';
import { describe, it, expect, beforeAll } from 'vitest';

describe('D1 integration', () => {
	beforeAll(async () => {
		await env.DB.prepare(
			`CREATE TABLE IF NOT EXISTS test_items (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			created_at TEXT NOT NULL
		)`
		).run();
	});

	it('has D1 binding', () => {
		expect(env.DB).toBeDefined();
	});

	it('can insert and query', async () => {
		const now = new Date().toISOString();
		await env.DB.prepare('INSERT INTO test_items (id, name, created_at) VALUES (?, ?, ?)')
			.bind('item-1', 'Test Item', now)
			.run();

		const row = await env.DB.prepare('SELECT * FROM test_items WHERE id = ?')
			.bind('item-1')
			.first();
		expect(row).toMatchObject({ id: 'item-1', name: 'Test Item' });
	});

	it('can run multiple operations', async () => {
		const now = new Date().toISOString();
		await env.DB.prepare('INSERT INTO test_items (id, name, created_at) VALUES (?, ?, ?)')
			.bind('multi-1', 'Multi 1', now)
			.run();
		await env.DB.prepare('INSERT INTO test_items (id, name, created_at) VALUES (?, ?, ?)')
			.bind('multi-2', 'Multi 2', now)
			.run();

		const result = await env.DB.prepare('SELECT COUNT(*) AS count FROM test_items WHERE id LIKE ?')
			.bind('multi-%')
			.first();
		expect((result as { count: number }).count).toBe(2);
	});
});
