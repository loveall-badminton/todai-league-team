import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, testUtils, username } from 'better-auth/plugins';
import { type CfTestDb } from '$lib/server/cfTestDb';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '$lib/server/db/schema';
import { env } from '$env/dynamic/private';

export function createTestAuth(testDb: CfTestDb) {
	const db = testDb.db;

	return betterAuth({
		baseURL: env.BETTER_AUTH_URL ?? 'http://localhost:5173',
		secret: env.BETTER_AUTH_SECRET ?? 'test-secret-do-not-use-in-production',
		emailAndPassword: { enabled: true },
		database: drizzleAdapter(db as unknown as DrizzleD1Database<typeof schema>, {
			provider: 'sqlite'
		}),
		plugins: [
			username({
				minUsernameLength: 3,
				maxUsernameLength: 64,
				usernameValidator: (value) => /^[a-z0-9_.-]+$/.test(value)
			}),
			admin({
				defaultRole: 'user',
				adminRoles: ['admin']
			}),
			testUtils()
		]
	});
}
