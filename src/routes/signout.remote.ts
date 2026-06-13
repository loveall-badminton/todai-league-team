import { form, getRequestEvent } from '$app/server';
import { redirect } from '@sveltejs/kit';

export const signOut = form(async () => {
	const { locals, request } = getRequestEvent();
	await locals.auth.api.signOut({
		headers: request.headers
	});
	redirect(303, '/auth/login');
});
