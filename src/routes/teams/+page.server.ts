import { adminPageLoadWithDefaults } from '$lib/server/loadHelpers';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const { teams } = await adminPageLoadWithDefaults();
	return { teams };
};
