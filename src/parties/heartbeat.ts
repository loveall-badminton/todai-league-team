import { createLivePongMessage, type LiveMessage } from '$lib/realtime/channels';

/**
 * パース済みメッセージがハートビート ping なら pong を返す純粋関数。
 * DO/partyserver ランタイムに依存しないため通常の vitest プロジェクトでテストできる。
 */
export function computeHeartbeatReply(message: LiveMessage): LiveMessage | null {
	return message.type === 'ping' ? createLivePongMessage() : null;
}
