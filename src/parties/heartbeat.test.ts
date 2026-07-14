import { describe, expect, test } from 'vitest';
import { computeHeartbeatReply } from './heartbeat';

describe('computeHeartbeatReply', () => {
	test('replies with a pong to a ping message', () => {
		const reply = computeHeartbeatReply(
			JSON.stringify({ type: 'ping', at: '2026-07-14T00:00:00.000Z' })
		);

		expect(reply?.type).toBe('pong');
	});

	test('ignores non-ping messages', () => {
		expect(
			computeHeartbeatReply(JSON.stringify({ type: 'hello', at: '2026-07-14T00:00:00.000Z' }))
		).toBeNull();
		expect(
			computeHeartbeatReply(JSON.stringify({ type: 'updated', topics: [], at: 'x' }))
		).toBeNull();
	});

	test('ignores malformed or non-string payloads without throwing', () => {
		expect(computeHeartbeatReply('not json')).toBeNull();
		expect(computeHeartbeatReply(new ArrayBuffer(4))).toBeNull();
		expect(computeHeartbeatReply(null)).toBeNull();
	});
});
