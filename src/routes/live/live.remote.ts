import { query } from '$app/server';
import {
	getLivePageData as loadLivePageData,
	getScoreProgressionData as loadScoreProgressionData
} from '$lib/server/services/livePageService';

export const getLivePageData = query(async () => {
	return loadLivePageData();
});

export const getActiveTies = query(async () => {
	return (await loadLivePageData()).activeTies;
});

export const getGroupStandings = query(async () => {
	return (await loadLivePageData()).standings;
});

export const getFinalsBoard = query(async () => {
	return (await loadLivePageData()).finalsBoard;
});

export const getSchedule = query(async () => {
	return (await loadLivePageData()).schedule;
});

export const getScoreProgression = query(async () => {
	return loadScoreProgressionData();
});
