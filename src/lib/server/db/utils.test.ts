import { describe, expect, test, vi } from 'vitest';
import { batchAll, batchQuery } from './utils';

describe('batchQuery', () => {
	test('returns an empty array when values is empty', async () => {
		const queryFn = vi.fn();
		const result = await batchQuery([], queryFn);
		expect(result).toEqual([]);
		expect(queryFn).not.toHaveBeenCalled();
	});

	test('splits large inputs into batches and concatenates results', async () => {
		const values = Array.from({ length: 150 }, (_, i) => i);
		const queryFn = vi.fn(async (batch: number[]) => batch.map((v) => v * 2));
		const result = await batchQuery(values, queryFn, 50);
		expect(queryFn).toHaveBeenCalledTimes(3);
		expect(result).toEqual(values.map((v) => v * 2));
	});
});

describe('batchAll', () => {
	test('returns early without calling db.batch for an empty query list', async () => {
		const db = { batch: vi.fn() } as unknown as { batch: typeof vi.fn };
		await batchAll(db as never, []);
		expect(db.batch).not.toHaveBeenCalled();
	});

	test('calls db.batch for a non-empty query list', async () => {
		const db = { batch: vi.fn() } as unknown as { batch: typeof vi.fn };
		await batchAll(db as never, ['q1' as never]);
		expect(db.batch).toHaveBeenCalledTimes(1);
	});
});
