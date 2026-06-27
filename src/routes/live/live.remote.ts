import { query } from '$app/server';
import { getCachedLivePageData } from '$lib/server/services/livePageCache';
import {
	getLivePageData as loadLivePageData,
	getScoreProgressionData
} from '$lib/server/services/livePageService';

export const getLivePageData = query(async () => {
	return getCachedLivePageData(loadLivePageData);
});

import type { ScoreProgressionData } from '$lib/server/services/livePageService';

type CacheEntry = { value: ScoreProgressionData; bornAt: number };
const PROGRESSION_TTL = 10_000;
const PROGRESSION_STALE_TTL = 30_000;

let progressionCache: CacheEntry | null = null;
let progressionInFlight: Promise<ScoreProgressionData> | null = null;

export const getScoreProgression = query(async () => {
	const now = Date.now();
	if (progressionCache && progressionCache.bornAt + PROGRESSION_TTL > now) {
		return progressionCache.value;
	}
	if (progressionCache && now - progressionCache.bornAt < PROGRESSION_STALE_TTL) {
		refreshProgression();
		return progressionCache.value;
	}
	if (progressionInFlight) return progressionInFlight;

	const data = await getScoreProgressionData();
	progressionCache = { value: data, bornAt: now };
	return data;
});

function refreshProgression(): void {
	if (progressionInFlight) return;
	progressionInFlight = getScoreProgressionData().then((data) => {
		progressionCache = { value: data, bornAt: Date.now() };
		return data;
	});
	progressionInFlight.catch(() => {});
	progressionInFlight.finally(() => {
		progressionInFlight = null;
	});
}
