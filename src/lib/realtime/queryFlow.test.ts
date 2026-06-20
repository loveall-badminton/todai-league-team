import { describe, expect, test, vi } from 'vitest';
import { createRealtimeQueryFlow } from './queryFlow';
import type { RealtimeUpdate } from './updates';

function update(partial: Partial<RealtimeUpdate> = {}): RealtimeUpdate {
	return {
		topics: ['schedule'],
		source: 'live',
		channel: 'live-board',
		...partial
	};
}

describe('createRealtimeQueryFlow', () => {
	test('does not refresh when websocket update is fully applied locally', async () => {
		const refresh = vi.fn(async () => undefined);
		const handle = createRealtimeQueryFlow({
			refresh,
			applyUpdate: () => 'applied'
		});

		await handle(update());

		expect(refresh).not.toHaveBeenCalled();
	});

	test('coalesces concurrent refresh requests', async () => {
		const refresh = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					setTimeout(resolve, 10);
				})
		);
		const handle = createRealtimeQueryFlow({
			refresh,
			applyUpdate: () => 'refresh'
		});

		await Promise.all([handle(update()), handle(update()), handle(update())]);

		expect(refresh).toHaveBeenCalledTimes(1);
	});

	test('uses shouldRefresh when no local apply path exists', async () => {
		const refresh = vi.fn(async () => undefined);
		const handle = createRealtimeQueryFlow({
			refresh,
			shouldRefresh: (incoming) => incoming.topics.includes('score')
		});

		await handle(update({ topics: ['schedule'] }));
		await handle(update({ topics: ['score'] }));

		expect(refresh).toHaveBeenCalledTimes(1);
	});
});
