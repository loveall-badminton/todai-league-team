import { describe, expect, test } from 'vitest';
import { computeHeartbeatReply } from './heartbeat';
import type { LiveMessage } from '$lib/realtime/channels';

describe('computeHeartbeatReply', () => {
	test('replies with a pong to a ping message', () => {
		const reply = computeHeartbeatReply({ type: 'ping', at: '2026-07-14T00:00:00.000Z' });

		expect(reply?.type).toBe('pong');
	});

	test('ignores non-ping messages', () => {
		expect(
			computeHeartbeatReply({ type: 'hello', at: '2026-07-14T00:00:00.000Z', seqNo: 0 })
		).toBeNull();
		expect(
			computeHeartbeatReply({
				type: 'updated',
				topics: ['score'],
				at: 'x',
				seqNo: 1
			} as LiveMessage)
		).toBeNull();
	});
});
