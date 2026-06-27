import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, username } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { BETTER_AUTH_URL, BETTER_AUTH_SECRET } from '$env/static/private';
import { getRequestEvent } from '$app/server';
import { getDb } from '$lib/server/db';

export const createAuth = (d1: D1Database, overrides?: { secret?: string; url?: string }) =>
	betterAuth({
		baseURL: overrides?.url ?? BETTER_AUTH_URL,
		secret: overrides?.secret ?? BETTER_AUTH_SECRET,
		emailAndPassword: { enabled: true },
		session: {
			cookieCache: { enabled: true, maxAge: 60 * 60, strategy: 'compact' },
			deferSessionRefresh: true
		},
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
			sveltekitCookies(getRequestEvent)
		],
		database: drizzleAdapter(getDb(d1), { provider: 'sqlite' })
	});
