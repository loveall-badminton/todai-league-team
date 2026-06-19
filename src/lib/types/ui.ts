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
