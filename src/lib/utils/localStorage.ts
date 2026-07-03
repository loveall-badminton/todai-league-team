import * as v from 'valibot';
import { browser } from '$app/environment';

export function loadJsonFromLocalStorage<const TSchema extends v.GenericSchema>(
	key: string,
	schema: TSchema
): v.InferOutput<TSchema> | null {
	if (!browser) return null;

	let raw: string | null;
	try {
		raw = localStorage.getItem(key);
	} catch {
		return null;
	}
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

	// iOS Safari のプライベートブラウズ等では setItem が例外を投げる
	try {
		localStorage.setItem(key, JSON.stringify(result.output));
	} catch {
		return null;
	}
	return result.output;
}

export function removeLocalStorageItem(key: string) {
	if (!browser) return;
	try {
		localStorage.removeItem(key);
	} catch {
		// ストレージが利用できない環境では何もしない
	}
}
