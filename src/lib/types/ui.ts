export interface SelectItem {
	value: string;
	label: string;
}

export interface SelectItemWithCount extends SelectItem {
	count?: number;
}

export interface SelectItemWithDisabled extends SelectItem {
	disabled?: boolean;
}

/** SvelteKit remote query の値ラッパー(query(...) の戻り値を props で受ける際の型) */
export type QueryValue<T> = { current: T | null | undefined };
