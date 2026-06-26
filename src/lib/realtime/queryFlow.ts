import type { RealtimeUpdate } from './updates';

export type RealtimeApplyResult = 'applied' | 'refresh' | 'ignore';

export interface RealtimeQueryFlowOptions {
	refresh: () => Promise<unknown> | unknown;
	applyUpdate?: (update: RealtimeUpdate) => RealtimeApplyResult;
	shouldRefresh?: (update: RealtimeUpdate) => boolean;
	debounceMs?: number;
}

export function createRealtimeQueryFlow(options: RealtimeQueryFlowOptions) {
	const debounceMs = options.debounceMs ?? 200;
	let refreshInFlight: Promise<void> | null = null;
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

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
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = null;
			await refreshOnce();
			return;
		}
		if (options.shouldRefresh?.(update) ?? true) {
			if (debounceMs > 0) {
				if (debounceTimer) clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => {
					debounceTimer = null;
					refreshOnce();
				}, debounceMs);
			} else {
				await refreshOnce();
			}
		}
	};
}
