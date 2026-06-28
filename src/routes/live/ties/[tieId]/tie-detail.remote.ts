import { query } from '$app/server';
import * as v from 'valibot';
import { getTiePageData, type TiePageData } from '$lib/server/services/liveBoardService';
import {
	getScoreProgressionForTie,
	type ScoreProgressionData
} from '$lib/server/services/livePageService';

// Per-tieId cache for tie detail (rubber scores + tie header)
type TieDetailCacheEntry = { value: TiePageData; bornAt: number };
const tieDetailCache = new Map<string, TieDetailCacheEntry>();
const tieDetailInFlight = new Map<string, Promise<TiePageData | null>>();
const TIE_DETAIL_TTL = 3_000;
const TIE_DETAIL_STALE_TTL = 10_000;

export const getTieDetail = query(v.string(), async (tieId) => {
	const now = Date.now();
	const cached = tieDetailCache.get(tieId);
	if (cached && cached.bornAt + TIE_DETAIL_TTL > now) return cached.value;
	if (cached && now - cached.bornAt < TIE_DETAIL_STALE_TTL) {
		refreshTieDetail(tieId);
		return cached.value;
	}
	if (tieDetailInFlight.has(tieId)) return tieDetailInFlight.get(tieId)!;
	const data = await getTiePageData(tieId);
	if (data) tieDetailCache.set(tieId, { value: data, bornAt: now });
	return data;
});

function refreshTieDetail(tieId: string): void {
	if (tieDetailInFlight.has(tieId)) return;
	const p = getTiePageData(tieId).then((data) => {
		if (data) tieDetailCache.set(tieId, { value: data, bornAt: Date.now() });
		return data;
	});
	tieDetailInFlight.set(tieId, p);
	p.catch(() => {});
	p.finally(() => tieDetailInFlight.delete(tieId));
}

// Per-tieId cache for score progression (only this tie's active matches)
type ProgressionCacheEntry = { value: ScoreProgressionData; bornAt: number };
const progressionCache = new Map<string, ProgressionCacheEntry>();
const progressionInFlight = new Map<string, Promise<ScoreProgressionData>>();
const PROGRESSION_TTL = 10_000;
const PROGRESSION_STALE_TTL = 30_000;

export const getTieProgression = query(v.string(), async (tieId) => {
	const now = Date.now();
	const cached = progressionCache.get(tieId);
	if (cached && cached.bornAt + PROGRESSION_TTL > now) return cached.value;
	if (cached && now - cached.bornAt < PROGRESSION_STALE_TTL) {
		refreshProgression(tieId);
		return cached.value;
	}
	if (progressionInFlight.has(tieId)) return progressionInFlight.get(tieId)!;
	const data = await getScoreProgressionForTie(tieId);
	progressionCache.set(tieId, { value: data, bornAt: now });
	return data;
});

function refreshProgression(tieId: string): void {
	if (progressionInFlight.has(tieId)) return;
	const p = getScoreProgressionForTie(tieId).then((data) => {
		progressionCache.set(tieId, { value: data, bornAt: Date.now() });
		return data;
	});
	progressionInFlight.set(tieId, p);
	p.catch(() => {});
	p.finally(() => progressionInFlight.delete(tieId));
}
