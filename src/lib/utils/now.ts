export function now(): string {
	return new Date().toISOString();
}

export function newId(): string {
	return crypto.randomUUID();
}
