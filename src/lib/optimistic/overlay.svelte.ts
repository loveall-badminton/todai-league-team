export type ApplyResult = 'applied' | 'refresh' | 'ignore';

export interface OverlayOptions<TData, TPayload> {
	getServerData: () => TData;
	apply: (payload: TPayload, current: TData) => TData | 'refresh' | null;
	isNewer: (overlay: TData, serverData: TData) => boolean;
}

export class OptimisticOverlay<TData, TPayload> {
	#overlay: TData | null = $state.raw(null);
	#getServerData: () => TData;
	#applyPayload: (payload: TPayload, current: TData) => TData | 'refresh' | null;
	#isNewer: (a: TData, b: TData) => boolean;

	constructor(options: OverlayOptions<TData, TPayload>) {
		this.#getServerData = options.getServerData;
		this.#applyPayload = options.apply;
		this.#isNewer = options.isNewer;
	}

	data: TData = $derived.by(() => {
		const overlay = this.#overlay;
		const server = this.#getServerData();
		if (overlay !== null && this.#isNewer(overlay, server)) return overlay;
		return server;
	});

	hasOverlay = $derived(this.#overlay !== null);

	apply(payload: TPayload): ApplyResult {
		const current = this.#overlay ?? this.#getServerData();
		const result = this.#applyPayload(payload, current);
		if (result === 'refresh') return 'refresh';
		if (result === null) return 'ignore';
		this.#overlay = result;
		return 'applied';
	}

	reset(): void {
		this.#overlay = null;
	}
}
