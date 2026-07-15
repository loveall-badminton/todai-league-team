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
import { now as nowIso } from '$lib/utils/now';

function emit(
	label: string,
	channels: string[],
	topics: readonly LiveTopic[],
	data?: LiveUpdateData
): void {
	if (dev) {
		console.log(`[broadcast] ${label}`, { channels, topics, data, at: nowIso() });
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

const DISPATCH_MAX_ATTEMPTS = 3;
const DISPATCH_RETRY_DELAY_MS = 150;

async function sleep(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

async function dispatchWithRetry(
	stub: ReturnType<Env['LiveBoard']['getByName']>,
	channel: string,
	message: LiveMessage
): Promise<void> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= DISPATCH_MAX_ATTEMPTS; attempt++) {
		try {
			const response = await stub.fetch('https://live-board.internal/broadcast', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(message)
			});
			if (response.ok) return;
			lastError = new Error(`unexpected status ${response.status}`);
		} catch (err) {
			lastError = err;
		}
		if (attempt < DISPATCH_MAX_ATTEMPTS) {
			await sleep(DISPATCH_RETRY_DELAY_MS * attempt);
		}
	}
	// リトライしても配信できなかった場合、購読者は WS 経由の更新を永久に受け取れない
	// (RealtimeSync のポーリングフォールバックは "接続断" 検知が前提のため効かない)。
	// dev/prod を問わず必ずログに残し、本番では Cloudflare 側のログ監視で検知できるようにする。
	console.error('[broadcast] dispatch failed after retries', {
		channel,
		attempts: DISPATCH_MAX_ATTEMPTS,
		error: lastError instanceof Error ? lastError.message : String(lastError),
		at: nowIso()
	});
}

function dispatch(channel: string, message: LiveMessage): void {
	try {
		const { platform } = getRequestEvent();
		const namespace = platform?.env?.LiveBoard;
		if (!namespace) {
			if (dev) {
				console.warn('[broadcast] LiveBoard binding not available', {
					channel,
					at: nowIso()
				});
			}
			return;
		}

		const stub = namespace.getByName(channel);
		const task = dispatchWithRetry(stub, channel, message);
		platform?.ctx?.waitUntil?.(task);
	} catch (err) {
		console.error('[broadcast] dispatch exception', {
			channel,
			error: err instanceof Error ? err.message : String(err),
			at: nowIso()
		});
	}
}
