import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isAdminUser } from '$lib/server/auth/access';

export const load: PageServerLoad = async ({ locals }) => {
	if (!isAdminUser(locals.user)) redirect(303, '/live');
};
