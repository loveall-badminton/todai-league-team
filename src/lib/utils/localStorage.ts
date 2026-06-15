import * as v from 'valibot';
import { browser } from '$app/environment';

export function loadJsonFromLocalStorage<const TSchema extends v.GenericSchema>(
	key: string,
	schema: TSchema
): v.InferOutput<TSchema> | null {
	if (!browser) return null;

	const raw = localStorage.getItem(key);
	if (!raw) return null;

	try {
		const result = v.safeParse(schema, JSON.parse(raw));
		return result.success ? result.output : null;
	} catch {
		return null;
	}
}

export function saveJsonToLocalStorage<const TSchema extends v.GenericSchema>(
	key: string,
	schema: TSchema,
	value: unknown
): v.InferOutput<TSchema> | null {
	if (!browser) return null;

	const result = v.safeParse(schema, value);
	if (!result.success) return null;

	localStorage.setItem(key, JSON.stringify(result.output));
	return result.output;
}

export function removeLocalStorageItem(key: string) {
	if (!browser) return;
	localStorage.removeItem(key);
}
