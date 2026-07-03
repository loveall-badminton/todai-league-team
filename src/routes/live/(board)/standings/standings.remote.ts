import { query } from '$app/server';
import { createLayeredJsonCache } from '$lib/server/layeredCache';
import { CACHE_TTL, StandingsDataSchema } from '$lib/server/cacheSchemas';
import { getStandingsData } from '$lib/server/services/livePageService';

const standingsCache = createLayeredJsonCache({
	namespace: 'standings-page',
	version: 1,
	schema: StandingsDataSchema,
	ttlSeconds: CACHE_TTL.standings,
	tags: ['live', 'standings'],
	invalidateOn: ['standings', 'score', 'schedule']
});

export const getStandingsPageData = query(async () => {
	return standingsCache.remember({}, getStandingsData);
});
