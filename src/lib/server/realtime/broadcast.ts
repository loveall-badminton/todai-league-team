import { dev } from '$app/environment';
import { getRequestEvent } from '$app/server';
import {
	ALL_LIVE_TOPICS,
	LIVE_BOARD_CHANNEL,
	createLiveUpdatedMessage,
	matchChannel,
	type LiveTopic
} from '$lib/realtime/channels';
import type { LiveMessage, LiveUpdateData } from '$lib/realtime/channels';
import { invalidateLivePageCache, prewarmLivePageCache } from '$lib/server/services/livePageCache';
import { getLivePageData } from '$lib/server/services/livePageService';

export function notifyLiveBoard(): void;
export function notifyLiveBoard<TTopics extends readonly LiveTopic[]>(
	topics: TTopics,
	data?: LiveUpdateData<TTopics[number]>
): void;
export function notifyLiveBoard(
	topics: readonly LiveTopic[] = ALL_LIVE_TOPICS,
	data?: LiveUpdateData
): void {
	invalidateLivePageCache(topics);
	prewarmLivePageCache(getLivePageData);
	if (dev) {
		console.log('[broadcast] notifyLiveBoard', { topics, data, at: new Date().toISOString() });
	}
	dispatch(LIVE_BOARD_CHANNEL, createLiveUpdatedMessage(topics, data));
}

export function notifyMatch<TTopics extends readonly LiveTopic[]>(
	matchId: string,
	topics: TTopics,
	data?: LiveUpdateData<TTopics[number]>
): void {
	if (dev) {
		console.log('[broadcast] notifyMatch', { matchId, topics, data, at: new Date().toISOString() });
	}
	dispatch(matchChannel(matchId), createLiveUpdatedMessage(topics, data));
}

export function notifyScoreChange<TTopics extends readonly LiveTopic[]>(
	matchId: string,
	topics: TTopics,
	data?: LiveUpdateData<TTopics[number]>
): void {
	invalidateLivePageCache(topics);
	prewarmLivePageCache(getLivePageData);
	if (dev) {
		console.log('[broadcast] notifyScoreChange', {
			matchId,
			topics,
			data,
			at: new Date().toISOString()
		});
	}
	const message = createLiveUpdatedMessage(topics, data);
	dispatch(LIVE_BOARD_CHANNEL, message);
	dispatch(matchChannel(matchId), message);
}

function dispatch(channel: string, message: LiveMessage): void {
	try {
		const { platform } = getRequestEvent();
		const namespace = platform?.env?.LiveBoard;
		if (!namespace) {
			if (dev) {
				console.warn('[broadcast] LiveBoard binding not available', {
					channel,
					at: new Date().toISOString()
				});
			}
			return;
		}

		const stub = namespace.getByName(channel);
		const task = stub
			.fetch('https://live-board.internal/broadcast', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(message)
			})
			.then(() => undefined)
			.catch((err) => {
				if (dev) {
					console.warn('[broadcast] dispatch error', {
						channel,
						error: String(err),
						at: new Date().toISOString()
					});
				}
			});

		platform?.ctx?.waitUntil?.(task);
	} catch (err) {
		if (dev) {
			console.warn('[broadcast] dispatch exception', {
				channel,
				error: String(err),
				at: new Date().toISOString()
			});
		}
	}
}
