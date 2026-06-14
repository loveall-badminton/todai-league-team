import { getRequestEvent, query } from '$app/server';
import { isAdminUser } from '$lib/server/auth/access';
import { listTies } from '$lib/server/repositories/tokyoLeagueRepository';
import { error } from '@sveltejs/kit';

export const getDashboardData = query(async () => {
	const event = getRequestEvent();
	if (!isAdminUser(event.locals.user)) error(403, 'Admin only');
	const ties = await listTies();
	return {
		playing: ties.filter((t) => t.status === 'playing'),
		recentTies: ties.slice(0, 10)
	};
});
