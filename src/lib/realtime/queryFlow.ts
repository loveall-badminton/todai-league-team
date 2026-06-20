import type { RealtimeUpdate } from './updates';

export type RealtimeApplyResult = 'applied' | 'refresh' | 'ignore';

export interface RealtimeQueryFlowOptions {
	refresh: () => Promise<unknown> | unknown;
	applyUpdate?: (update: RealtimeUpdate) => RealtimeApplyResult;
	shouldRefresh?: (update: RealtimeUpdate) => boolean;
}

export function createRealtimeQueryFlow(options: RealtimeQueryFlowOptions) {
	let refreshInFlight: Promise<void> | null = null;

	async function refreshOnce() {
		if (refreshInFlight) return refreshInFlight;
		refreshInFlight = Promise.resolve(options.refresh()).then(() => undefined);
		try {
			await refreshInFlight;
		} finally {
			refreshInFlight = null;
		}
	}

	return async function handleRealtimeUpdate(update: RealtimeUpdate): Promise<void> {
		const result = options.applyUpdate?.(update);
		if (result === 'applied' || result === 'ignore') return;
		if (result === 'refresh') {
			await refreshOnce();
			return;
		}
		if (options.shouldRefresh?.(update) ?? true) {
			await refreshOnce();
		}
	};
}
