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

function emit(
	label: string,
	channels: string[],
	topics: readonly LiveTopic[],
	data?: LiveUpdateData
): void {
	if (dev) {
		console.log(`[broadcast] ${label}`, { channels, topics, data, at: new Date().toISOString() });
	}
	const message = createLiveUpdatedMessage(topics, data);
	for (const channel of channels) {
		dispatch(channel, message);
	}
}

export function notifyLiveBoard(): void;
export function notifyLiveBoard<TTopics extends readonly LiveTopic[]>(
	topics: TTopics,
	data?: LiveUpdateData<TTopics[number]>
): void;
export function notifyLiveBoard(
	topics: readonly LiveTopic[] = ALL_LIVE_TOPICS,
	data?: LiveUpdateData
): void {
	emit('notifyLiveBoard', [LIVE_BOARD_CHANNEL], topics, data);
}

export function notifyMatch<TTopics extends readonly LiveTopic[]>(
	matchId: string,
	topics: TTopics,
	data?: LiveUpdateData<TTopics[number]>
): void {
	emit('notifyMatch', [matchChannel(matchId)], topics, data);
}

export function notifyScoreChange<TTopics extends readonly LiveTopic[]>(
	matchId: string,
	topics: TTopics,
	data?: LiveUpdateData<TTopics[number]>
): void {
	emit('notifyScoreChange', [LIVE_BOARD_CHANNEL, matchChannel(matchId)], topics, data);
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
