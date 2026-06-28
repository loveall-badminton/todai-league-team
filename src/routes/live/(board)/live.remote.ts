import { query } from '$app/server';
import { getScheduleData, type ScheduleData } from '$lib/server/services/livePageService';

type CacheEntry = { value: ScheduleData; bornAt: number };
let scheduleCache: CacheEntry | null = null;
let scheduleInFlight: Promise<ScheduleData> | null = null;
const SCHEDULE_TTL = 3_000;
const SCHEDULE_STALE_TTL = 10_000;

export const getSchedulePageData = query(async () => {
	const now = Date.now();
	if (scheduleCache && scheduleCache.bornAt + SCHEDULE_TTL > now) {
		return scheduleCache.value;
	}
	if (scheduleCache && now - scheduleCache.bornAt < SCHEDULE_STALE_TTL) {
		refreshSchedule();
		return scheduleCache.value;
	}
	if (scheduleInFlight) {
		try {
			return await scheduleInFlight;
		} catch {
			scheduleInFlight = null;
		}
	}
	const data = await getScheduleData();
	scheduleCache = { value: data, bornAt: now };
	return data;
});

function refreshSchedule(): void {
	if (scheduleInFlight) return;
	// Race against a timeout so scheduleInFlight always settles (prevents stuck module state
	// in local wrangler dev when a request is aborted before the D1 call completes).
	const timeout = new Promise<never>((_, reject) =>
		setTimeout(() => reject(new Error('schedule refresh timeout')), 5000)
	);
	scheduleInFlight = Promise.race([getScheduleData(), timeout]).then((data) => {
		scheduleCache = { value: data, bornAt: Date.now() };
		return data;
	});
	scheduleInFlight.catch(() => {});
	scheduleInFlight.finally(() => {
		scheduleInFlight = null;
	});
}
