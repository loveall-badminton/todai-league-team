import { query } from '$app/server';
import { createLayeredJsonCache } from '$lib/server/layeredCache';
import { CACHE_TTL, ScheduleDataSchema } from '$lib/server/cacheSchemas';
import { getScheduleData, type ScheduleData } from '$lib/server/services/livePageService';

const scheduleCache = createLayeredJsonCache({
	namespace: 'schedule-page',
	version: 1,
	schema: ScheduleDataSchema,
	ttlSeconds: CACHE_TTL.schedule,
	tags: ['live', 'schedule'],
	invalidateOn: ['schedule', 'standings', 'finals']
});

export const getSchedulePageData = query(async () => {
	return scheduleCache.remember({}, () => getScheduleData() as Promise<ScheduleData>);
});
