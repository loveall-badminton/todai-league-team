import { query } from '$app/server';
import * as v from 'valibot';
import { createLayeredJsonCache } from '$lib/server/layeredCache';
import { CACHE_TTL, ScoreProgressionDataSchema, TiePageDataSchema } from '$lib/server/cacheSchemas';
import { getTiePageData } from '$lib/server/services/liveBoardService';
import { getScoreProgressionForTie } from '$lib/server/services/livePageService';

// 存在しない tie の null も含めてキャッシュし、ヒット時に D1 を触らないようにする
const tieDetailCache = createLayeredJsonCache({
	namespace: 'tie-detail',
	version: 2,
	schema: v.nullable(TiePageDataSchema),
	ttlSeconds: CACHE_TTL.tieDetail,
	tags: ['live', 'tie'],
	invalidateOn: ['score', 'schedule']
});

const progressionCache = createLayeredJsonCache({
	namespace: 'tie-progression',
	version: 1,
	schema: ScoreProgressionDataSchema,
	ttlSeconds: CACHE_TTL.tieProgression,
	tags: ['live', 'tie'],
	invalidateOn: ['score']
});

export const getTieDetail = query(v.string(), async (tieId) => {
	return tieDetailCache.remember({ parts: [tieId] }, () => getTiePageData(tieId));
});

export const getTieProgression = query(v.string(), async (tieId) => {
	return progressionCache.remember({ parts: [tieId] }, () => getScoreProgressionForTie(tieId));
});
