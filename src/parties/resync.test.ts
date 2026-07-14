import { describe, expect, test } from 'vitest';
import { computeResyncReplies, resolveResyncReplies } from './resync';
import type { LiveUpdatedMessage } from '$lib/realtime/channels';

function updated(seqNo: number): LiveUpdatedMessage {
	return { type: 'updated', topics: ['score'], at: '2026-07-14T00:00:00.000Z', seqNo };
}

describe('resolveResyncReplies', () => {
	test('replays only messages newer than sinceSeqNo', () => {
		const buffer = [updated(1), updated(2), updated(3)];

		const replies = resolveResyncReplies(1, buffer);

		expect(replies).toEqual([updated(2), updated(3)]);
	});

	test('returns nothing when the client is already caught up', () => {
		const buffer = [updated(1), updated(2)];

		expect(resolveResyncReplies(2, buffer)).toEqual([]);
		expect(resolveResyncReplies(5, buffer)).toEqual([]);
	});

	test('fails resync when the buffer no longer covers the gap', () => {
		// バッファには 10 以降しか残っていないが、クライアントは 3 までしか受け取っていない
		const buffer = [updated(10), updated(11)];

		const replies = resolveResyncReplies(3, buffer);

		expect(replies).toEqual([{ type: 'resync_failed', at: expect.any(String) }]);
	});

	test('does not fail when the buffer is empty and the client has never received anything', () => {
		expect(resolveResyncReplies(0, [])).toEqual([]);
	});

	test('fails when the buffer is empty but the client expected history (DO restarted)', () => {
		const replies = resolveResyncReplies(5, []);

		expect(replies).toEqual([{ type: 'resync_failed', at: expect.any(String) }]);
	});
});

describe('computeResyncReplies', () => {
	test('parses a resync request and returns replies from the buffer', () => {
		const buffer = [updated(1), updated(2)];
		const message = JSON.stringify({ type: 'resync', sinceSeqNo: 1 });

		expect(computeResyncReplies(message, buffer)).toEqual([updated(2)]);
	});

	test('ignores non-resync or malformed messages', () => {
		expect(computeResyncReplies(JSON.stringify({ type: 'ping', at: 'x' }), [])).toEqual([]);
		expect(computeResyncReplies('not json', [])).toEqual([]);
		expect(computeResyncReplies(new ArrayBuffer(4), [])).toEqual([]);
	});
});
