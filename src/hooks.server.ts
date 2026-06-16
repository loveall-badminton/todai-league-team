import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { createAuth } from '$lib/server/auth';
import { getAuthProfile } from '$lib/server/auth/access';
import { svelteKitHandler } from 'better-auth/svelte-kit';

const AUTH_PATHS = ['/auth/login', '/auth/bootstrap', '/api/live'];

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	if (!event.platform?.env?.DB)
		throw new Error('D1 binding "DB" not found - are you running with wrangler?');

	event.locals.auth = createAuth(event.platform.env.DB);

	const { auth } = event.locals;
	const session = await auth.api.getSession({ headers: event.request.headers });
	const pathname = event.url.pathname;

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
		event.locals.authProfile = await getAuthProfile(session.user);
	}

	if (pathname.startsWith('/api/auth')) {
		return svelteKitHandler({ event, resolve, auth, building });
	}

	if (!session && !AUTH_PATHS.includes(pathname)) {
		const redirectTo = `${event.url.pathname}${event.url.search}`;
		return new Response(null, {
			status: 303,
			headers: { location: `/auth/login?redirectTo=${encodeURIComponent(redirectTo)}` }
		});
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
