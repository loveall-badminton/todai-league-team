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
