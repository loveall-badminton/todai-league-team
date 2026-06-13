import type { PageServerLoad } from './$types';
import { loadLiveOverviewPageData } from './load';

export const load: PageServerLoad = async ({ platform }) => {
	return loadLiveOverviewPageData(platform);
};
