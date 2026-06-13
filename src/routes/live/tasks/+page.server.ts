import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadLiveTasksPageData } from '../load';

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (locals.authProfile?.accountType !== 'team' || !locals.authProfile.teamId) {
		error(403, 'このページはチームアカウントのみアクセスできます');
	}

	return loadLiveTasksPageData(platform, locals.authProfile);
};
