import { getRequestEvent, query } from '$app/server';
import { isAdminUser } from '$lib/server/auth/access';
import { listTies } from '$lib/server/repositories/tokyoLeagueRepository';
import { error } from '@sveltejs/kit';

async function getDashboardTies() {
	const event = getRequestEvent();
	if (!isAdminUser(event.locals.user)) error(403, 'Admin only');
	return listTies();
}

export const getDashboardData = query(async () => {
	const ties = await getDashboardTies();
	return {
		playing: ties.filter((t) => t.status === 'playing'),
		recentTies: ties.slice(0, 10)
	};
});

export const getDashboardPlayingTies = query(async () => {
	const ties = await getDashboardTies();
	return ties.filter((t) => t.status === 'playing');
});

export const getDashboardRecentTies = query(async () => {
	const ties = await getDashboardTies();
	return ties.slice(0, 10);
});
