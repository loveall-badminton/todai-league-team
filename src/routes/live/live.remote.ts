import { query } from '$app/server';
import { getLivePageData as loadLivePageData } from '$lib/server/services/livePageService';

export const getLivePageData = query(async () => {
	return loadLivePageData();
});
