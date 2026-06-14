import { requireAdmin } from '$lib/server/auth/access';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	requireAdmin();
};
