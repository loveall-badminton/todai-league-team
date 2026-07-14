import { createLivePongMessage, parseLiveMessage, type LiveMessage } from '$lib/realtime/channels';

/**
 * クライアントのハートビート ping に対する応答を組み立てる純粋関数。
 * DO/partyserver ランタイムに依存しないため、onMessage の分岐ロジックを
 * (cloudflare:workers を要求しない) 通常の vitest プロジェクトでテストできる。
 */
export function computeHeartbeatReply(message: unknown): LiveMessage | null {
	if (typeof message !== 'string') return null;
	let raw: unknown;
	try {
		raw = JSON.parse(message);
	} catch {
		return null;
	}
	const parsed = parseLiveMessage(raw);
	return parsed?.type === 'ping' ? createLivePongMessage() : null;
}
