import { query } from '$app/server';
import { getCachedLivePageData } from '$lib/server/services/livePageCache';
import { getLivePageData as loadLivePageData } from '$lib/server/services/livePageService';

export const getLivePageData = query(async () => {
	return getCachedLivePageData(loadLivePageData);
});
