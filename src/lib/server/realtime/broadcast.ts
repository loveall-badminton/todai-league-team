import { getRequestEvent } from '$app/server';
import {
	ALL_LIVE_TOPICS,
	LIVE_BOARD_CHANNEL,
	matchChannel,
	type LiveMessage,
	type LiveTopic
} from '$lib/realtime/channels';

export function notifyLiveBoard(topics: LiveTopic[] = [...ALL_LIVE_TOPICS]): void {
	console.log('[broadcast] notifyLiveBoard', { topics, at: new Date().toISOString() });
	dispatch(LIVE_BOARD_CHANNEL, { type: 'updated', topics, at: new Date().toISOString() });
}

export function notifyMatch(matchId: string, topics: LiveTopic[] = ['score']): void {
	console.log('[broadcast] notifyMatch', { matchId, topics, at: new Date().toISOString() });
	dispatch(matchChannel(matchId), { type: 'updated', topics, at: new Date().toISOString() });
}

function dispatch(channel: string, message: LiveMessage): void {
	try {
		const { platform } = getRequestEvent();
		const namespace = platform?.env?.LiveBoard;
		if (!namespace) {
			console.warn('[broadcast] LiveBoard binding not available', {
				channel,
				message,
				at: new Date().toISOString()
			});
			return;
		}

		const stub = namespace.getByName(channel);
		console.log('[broadcast] dispatching', { channel, message, at: new Date().toISOString() });
		const task = stub
			.fetch('https://live-board.internal/broadcast', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(message)
			})
			.then((res) => {
				console.log('[broadcast] dispatched ok', {
					channel,
					status: res.status,
					at: new Date().toISOString()
				});
			})
			.catch((err) => {
				console.warn('[broadcast] dispatch error', {
					channel,
					error: String(err),
					at: new Date().toISOString()
				});
			});

		platform?.ctx?.waitUntil?.(task);
	} catch (err) {
		console.warn('[broadcast] dispatch exception', {
			channel,
			error: String(err),
			at: new Date().toISOString()
		});
	}
}
