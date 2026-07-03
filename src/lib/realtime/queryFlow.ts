import type { LiveTopic } from './channels';
import type { RealtimeUpdate } from './updates';

export type RealtimeApplyResult = 'applied' | 'refresh' | 'ignore';

export interface RealtimeQueryFlowOptions<TTopic extends LiveTopic = LiveTopic> {
	refresh: () => Promise<unknown> | unknown;
	applyUpdate?: (update: RealtimeUpdate<TTopic>) => RealtimeApplyResult;
	shouldRefresh?: (update: RealtimeUpdate<TTopic>) => boolean;
	debounceMs?: number;
}

export function createRealtimeQueryFlow<TTopic extends LiveTopic = LiveTopic>(
	options: RealtimeQueryFlowOptions<TTopic>
) {
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

	return async function handleRealtimeUpdate(update: RealtimeUpdate<TTopic>): Promise<void> {
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
