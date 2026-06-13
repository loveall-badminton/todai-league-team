import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, username } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { BETTER_AUTH_URL, BETTER_AUTH_SECRET } from '$env/static/private';
import { getRequestEvent } from '$app/server';
import { getDb } from '$lib/server/db';

const authConfig = {
	baseURL: BETTER_AUTH_URL,
	secret: BETTER_AUTH_SECRET,
	emailAndPassword: { enabled: true },
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
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
} satisfies Omit<Parameters<typeof betterAuth>[0], 'database'>;

export const createAuth = (d1: D1Database) =>
	betterAuth({
		...authConfig,
		database: drizzleAdapter(getDb(d1), { provider: 'sqlite' })
	});

/**
 * DO NOT USE!
 *
 * This instance is used by the `better-auth` CLI for schema generation ONLY.
 * To access `auth` at runtime, use `event.locals.auth`.
 */
export const auth = createAuth(null!);
