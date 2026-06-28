import { query } from '$app/server';
import { createJsonCache } from '$lib/server/cache';
import { CACHE_TTL, StandingsDataSchema } from '$lib/server/cacheSchemas';
import { getStandingsData } from '$lib/server/services/livePageService';

const standingsCache = createJsonCache({
	namespace: 'standings-page',
	version: 1,
	schema: StandingsDataSchema,
	ttlSeconds: CACHE_TTL.standings,
	tags: ['live', 'standings']
});

export const getStandingsPageData = query(async () => {
	return standingsCache.remember({}, getStandingsData);
});
