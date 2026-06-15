import * as v from 'valibot';

type SearchParamValue = string | string[];

export function searchParamsToObject(
	searchParams: URLSearchParams
): Record<string, SearchParamValue> {
	const values: Record<string, SearchParamValue> = {};

	for (const key of searchParams.keys()) {
		const all = searchParams.getAll(key);
		values[key] = all.length > 1 ? all : (all[0] ?? '');
	}

	return values;
}

export function parseSearchParams<const TSchema extends v.GenericSchema>(
	searchParams: URLSearchParams,
	schema: TSchema,
	fallback: v.InferOutput<TSchema>
): v.InferOutput<TSchema> {
	const result = v.safeParse(schema, searchParamsToObject(searchParams));
	return result.success ? result.output : fallback;
}

export function updateUrlSearchParams<const TSchema extends v.GenericSchema>(
	url: URL,
	schema: TSchema,
	values: unknown,
	options: {
		omit?: (key: string, value: unknown) => boolean;
	} = {}
): URL | null {
	const result = v.safeParse(schema, values);
	if (!result.success || !isSearchParamObject(result.output)) return null;

	const next = new URL(url);
	for (const [key, value] of Object.entries(result.output)) {
		next.searchParams.delete(key);
		if (value == null || options.omit?.(key, value)) continue;

		if (Array.isArray(value)) {
			for (const item of value) {
				next.searchParams.append(key, String(item));
			}
			continue;
		}

		next.searchParams.set(key, String(value));
	}

	return next;
}

function isSearchParamObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
