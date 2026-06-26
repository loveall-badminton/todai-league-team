import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { createAuth } from '$lib/server/auth';
import { getAuthProfile } from '$lib/server/auth/access';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { checkRateLimit, API_RATE_LIMIT, AUTH_RATE_LIMIT } from '$lib/server/ratelimit';

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

	const isAuthPath = pathname.startsWith('/auth/login') || pathname.startsWith('/auth/bootstrap');
	const isApiPath = pathname.startsWith('/api/');

	if (isAuthPath || isApiPath) {
		const ip = event.request.headers.get('cf-connecting-ip') ?? 'unknown';
		const config = isAuthPath ? AUTH_RATE_LIMIT : API_RATE_LIMIT;
		const check = checkRateLimit(ip, config);
		if (!check.allowed) {
			return new Response('Too Many Requests', {
				status: 429,
				headers: {
					'retry-after': String(Math.ceil(check.retryAfterMs / 1000))
				}
			});
		}
	}

	const response = await svelteKitHandler({ event, resolve, auth, building });

	if (pathname.startsWith('/api/live') || pathname.startsWith('/_app/immutable/')) {
		response.headers.set(
			'cache-control',
			pathname.startsWith('/_app/immutable/')
				? 'public, max-age=31536000, immutable'
				: 'public, max-age=5, must-revalidate'
		);
	}

	return response;
};

export const handle: Handle = handleBetterAuth;
