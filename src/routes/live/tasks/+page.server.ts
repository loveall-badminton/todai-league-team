import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import type { PageServerLoad } from './$types';
import { loadLiveTasksPageData } from '$lib/server/services/liveTasksService';

export const load: PageServerLoad = async () => {
	const { locals } = getRequestEvent();
	if (locals.authProfile?.accountType !== 'team' || !locals.authProfile.teamId) {
		error(403, 'このページはチームアカウントのみアクセスできます');
	}

	return loadLiveTasksPageData(locals.authProfile);
};
