import { query } from '$app/server';
import { getStandingsData, type StandingsData } from '$lib/server/services/livePageService';

type CacheEntry = { value: StandingsData; bornAt: number };
let standingsCache: CacheEntry | null = null;
let standingsInFlight: Promise<StandingsData> | null = null;
const STANDINGS_TTL = 5_000;
const STANDINGS_STALE_TTL = 15_000;

export const getStandingsPageData = query(async () => {
	const now = Date.now();
	if (standingsCache && standingsCache.bornAt + STANDINGS_TTL > now) {
		return standingsCache.value;
	}
	if (standingsCache && now - standingsCache.bornAt < STANDINGS_STALE_TTL) {
		refreshStandings();
		return standingsCache.value;
	}
	if (standingsInFlight) return standingsInFlight;
	const data = await getStandingsData();
	standingsCache = { value: data, bornAt: now };
	return data;
});

function refreshStandings(): void {
	if (standingsInFlight) return;
	standingsInFlight = getStandingsData().then((data) => {
		standingsCache = { value: data, bornAt: Date.now() };
		return data;
	});
	standingsInFlight.catch(() => {});
	standingsInFlight.finally(() => {
		standingsInFlight = null;
	});
}
