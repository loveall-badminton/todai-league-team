import { query } from '$app/server';
import * as v from 'valibot';
import { createJsonCache } from '$lib/server/cache';
import { CACHE_TTL, ScoreProgressionDataSchema, TiePageDataSchema } from '$lib/server/cacheSchemas';
import { getTiePageData } from '$lib/server/services/liveBoardService';
import { getScoreProgressionForTie } from '$lib/server/services/livePageService';

const tieDetailCache = createJsonCache({
	namespace: 'tie-detail',
	version: 1,
	schema: TiePageDataSchema,
	ttlSeconds: CACHE_TTL.tieDetail,
	tags: ['live', 'tie']
});

const progressionCache = createJsonCache({
	namespace: 'tie-progression',
	version: 1,
	schema: ScoreProgressionDataSchema,
	ttlSeconds: CACHE_TTL.tieProgression,
	tags: ['live', 'tie']
});

export const getTieDetail = query(v.string(), async (tieId) => {
	const data = await getTiePageData(tieId);
	if (!data) return null;
	return tieDetailCache.remember({ parts: [tieId] }, async () => data);
});

export const getTieProgression = query(v.string(), async (tieId) => {
	return progressionCache.remember({ parts: [tieId] }, () => getScoreProgressionForTie(tieId));
});
