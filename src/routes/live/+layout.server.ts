import { loadPendingLineupBanner } from '$lib/server/services/liveTasksService';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const pendingLineups =
		locals.authProfile?.accountType === 'team' && locals.authProfile.teamId
			? await loadPendingLineupBanner(locals.authProfile.teamId)
			: [];

	return { pendingLineups };
};
