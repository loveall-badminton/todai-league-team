export const emptyToNull = (s: string | undefined | null): string | null => {
	const text = (s ?? '').trim();
	return text === '' ? null : text;
};

export const uniqueNonEmpty = (values: string[] | undefined): string[] => [
	...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))
];

export const venueOrNull = (s: string | undefined | null): 'first_gym' | 'second_gym' | null => {
	if (s === 'first_gym' || s === 'second_gym') return s;
	return null;
};
