export function parseGroupCode(value: string): 'A' | 'B' | null {
	if (value === 'A' || value === 'B') return value;
	return null;
}
