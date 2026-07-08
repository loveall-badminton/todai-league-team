type Fn<T> = () => T;

function identityTransform<TItem>(item: TItem, patch: Partial<TItem>): TItem {
	return { ...item, ...patch };
}

export interface PatchCollectionOptions<TItem> {
	getServerItems: Fn<TItem[]>;
	getId: (item: TItem) => string;
	transform?: (item: TItem, patch: Partial<TItem>) => TItem;
	reconcileDelayMs?: number;
	onReconcile?: () => void | Promise<void>;
}

export class PatchCollection<TItem> {
	#patches = $state<Record<string, Partial<TItem>>>({});
	#getServerItems: Fn<TItem[]>;
	#getId: (item: TItem) => string;
	#transform: (item: TItem, patch: Partial<TItem>) => TItem;
	#reconcileDelayMs: number;
	#onReconcile?: () => void | Promise<void>;
	#reconcileTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(options: PatchCollectionOptions<TItem>) {
		this.#getServerItems = options.getServerItems;
		this.#getId = options.getId;
		this.#transform = options.transform ?? identityTransform;
		this.#reconcileDelayMs = options.reconcileDelayMs ?? 11000;
		this.#onReconcile = options.onReconcile;
	}

	items: TItem[] = $derived.by(() => {
		const patches = this.#patches;
		const keys = Object.keys(patches);
		if (keys.length === 0) return this.#getServerItems();
		return this.#getServerItems().map((item) => {
			const id = this.#getId(item);
			return id in patches ? this.#transform(item, patches[id]) : item;
		});
	});

	hasPatches = $derived(Object.keys(this.#patches).length > 0);

	apply(id: string, patch: Partial<TItem>): void {
		this.#patches[id] = { ...this.#patches[id], ...patch };
		this.#patches = { ...this.#patches };
	}

	remove(id: string): void {
		if (!(id in this.#patches)) return;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { [id]: _, ...rest } = this.#patches;
		this.#patches = rest;
	}

	get(id: string): Partial<TItem> | undefined {
		return this.#patches[id];
	}

	snapshot(): Record<string, Partial<TItem>> {
		return { ...this.#patches };
	}

	invalidateStale(snapshot: Record<string, Partial<TItem>>): void {
		const current = this.#patches;
		const next: Record<string, Partial<TItem>> = {};
		let changed = false;
		for (const [id, patch] of Object.entries(current)) {
			if (snapshot[id] !== patch) {
				next[id] = patch;
			} else {
				changed = true;
			}
		}
		if (changed) this.#patches = next;
	}

	scheduleReconcile(): void {
		if (this.#reconcileTimer !== null || !this.#onReconcile) return;
		this.#reconcileTimer = setTimeout(() => {
			this.#reconcileTimer = null;
			void this.#onReconcile!();
		}, this.#reconcileDelayMs);
	}

	destroy(): void {
		if (this.#reconcileTimer !== null) {
			clearTimeout(this.#reconcileTimer);
			this.#reconcileTimer = null;
		}
	}

	clear(): void {
		this.#patches = {};
	}
}
