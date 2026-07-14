import type { BatchItem } from 'drizzle-orm/batch';
import type { RequestDb } from '$lib/server/repositories/matchStateStore';

/**
 * Runs multiple queries in batches of values to stay under D1's 100 bind variable limit.
 */
export async function batchQuery<TValue, TResult>(
	values: TValue[],
	queryFn: (batch: TValue[]) => Promise<TResult[]>,
	batchSize = 99
): Promise<TResult[]> {
	if (values.length === 0) return [];
	const results: TResult[] = [];
	for (let i = 0; i < values.length; i += batchSize) {
		const batch = values.slice(i, i + batchSize);
		const batchResults = await queryFn(batch);
		results.push(...batchResults);
	}
	return results;
}

/**
 * db.batch() の型は非空タプル (readonly [BatchItem, ...BatchItem[]]) を要求するが、
 * .map()/spread で作った配列は T[] としてしか推論されずタプルに一致しない。
 * このヘルパーに型アサーションを一箇所へ集約する。
 */
export async function batchAll<T extends BatchItem<'sqlite'>>(
	db: RequestDb,
	queries: T[]
): Promise<void> {
	if (queries.length === 0) return;
	await db.batch(queries as [T, ...T[]]);
}
