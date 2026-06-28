import { query } from '$app/server';
import { createJsonCache } from '$lib/server/cache';
import { CACHE_TTL, ScheduleDataSchema } from '$lib/server/cacheSchemas';
import { getScheduleData, type ScheduleData } from '$lib/server/services/livePageService';

const scheduleCache = createJsonCache({
	namespace: 'schedule-page',
	version: 1,
	schema: ScheduleDataSchema,
	ttlSeconds: CACHE_TTL.schedule,
	tags: ['live', 'schedule']
});

export const getSchedulePageData = query(async () => {
	return scheduleCache.remember({}, () => getScheduleData() as Promise<ScheduleData>);
});
