import { describe, expect, test, vi } from 'vitest';
import { PatchCollection } from './patchCollection.svelte';

interface Item {
	id: string;
	name: string;
	score: number;
}

describe('PatchCollection', () => {
	const baseItems: Item[] = [
		{ id: 'a', name: 'alpha', score: 0 },
		{ id: 'b', name: 'beta', score: 10 },
		{ id: 'c', name: 'gamma', score: 20 }
	];

	test('items は初期状態でサーバーアイテムを返す', () => {
		const pc = new PatchCollection<Item>({
			getServerItems: () => baseItems,
			getId: (item) => item.id
		});
		expect(pc.items).toEqual(baseItems);
		expect(pc.hasPatches).toBe(false);
	});

	test('apply でアイテムにパッチがマージされる', () => {
		const pc = new PatchCollection<Item>({
			getServerItems: () => baseItems,
			getId: (item) => item.id
		});
		pc.apply('a', { score: 5 });
		expect(pc.items[0]).toEqual({ id: 'a', name: 'alpha', score: 5 });
		expect(pc.items[1]).toEqual({ id: 'b', name: 'beta', score: 10 });
		expect(pc.hasPatches).toBe(true);
	});

	test('複数のパッチを同時に適用できる', () => {
		const pc = new PatchCollection<Item>({
			getServerItems: () => baseItems,
			getId: (item) => item.id
		});
		pc.apply('a', { score: 5 });
		pc.apply('b', { score: 15, name: 'zeta' });
		expect(pc.items[0]).toEqual({ id: 'a', name: 'alpha', score: 5 });
		expect(pc.items[1]).toEqual({ id: 'b', name: 'zeta', score: 15 });
		expect(pc.items[2]).toEqual({ id: 'c', name: 'gamma', score: 20 });
	});

	test('remove でパッチが削除される', () => {
		const pc = new PatchCollection<Item>({
			getServerItems: () => baseItems,
			getId: (item) => item.id
		});
		pc.apply('a', { score: 5 });
		expect(pc.hasPatches).toBe(true);
		pc.remove('a');
		expect(pc.items[0]).toEqual({ id: 'a', name: 'alpha', score: 0 });
		expect(pc.hasPatches).toBe(false);
	});

	test('あいまいな ID の remove は何もしない', () => {
		const pc = new PatchCollection<Item>({
			getServerItems: () => baseItems,
			getId: (item) => item.id
		});
		pc.apply('a', { score: 5 });
		pc.remove('nonexistent');
		expect(pc.hasPatches).toBe(true);
	});

	test('snapshot は現在のパッチのコピーを返す', () => {
		const pc = new PatchCollection<Item>({
			getServerItems: () => baseItems,
			getId: (item) => item.id
		});
		pc.apply('a', { score: 5 });
		const snap = pc.snapshot();
		expect(snap).toEqual({ a: { score: 5 } });
		// snapshot のレコードは独立したコピーだが内部オブジェクトは同一参照
		// （identity 比較による stale 検出のため）
		expect(snap).not.toBe(pc.snapshot());
	});

	test('invalidateStale は snapshot と同一インスタンスのパッチを削除する', () => {
		const pc = new PatchCollection<Item>({
			getServerItems: () => baseItems,
			getId: (item) => item.id
		});
		pc.apply('a', { score: 5 });
		pc.apply('b', { score: 15 });
		const snap = pc.snapshot();
		// 'b' を refresh 中に更新（新しいオブジェクト）
		pc.apply('b', { score: 20 });
		pc.invalidateStale(snap);
		// 'a' は stale → 削除、'b' は更新されたので維持
		expect(pc.get('a')).toBeUndefined();
		expect(pc.get('b')).toEqual({ score: 20 });
	});

	test('transform コールバックでカスタムマージができる', () => {
		const pc = new PatchCollection<Item>({
			getServerItems: () => baseItems,
			getId: (item) => item.id,
			transform: (item, patch) =>
				patch
					? { id: item.id, name: `${item.name}-patched`, score: patch.score ?? item.score }
					: item
		});
		pc.apply('a', { score: 99 });
		expect(pc.items[0]).toEqual({ id: 'a', name: 'alpha-patched', score: 99 });
	});

	test('clear は全パッチを削除する', () => {
		const pc = new PatchCollection<Item>({
			getServerItems: () => baseItems,
			getId: (item) => item.id
		});
		pc.apply('a', { score: 5 });
		pc.apply('b', { score: 15 });
		pc.clear();
		expect(pc.hasPatches).toBe(false);
		expect(pc.items).toEqual(baseItems);
	});

	test('get で個別パッチを取得できる', () => {
		const pc = new PatchCollection<Item>({
			getServerItems: () => baseItems,
			getId: (item) => item.id
		});
		pc.apply('a', { score: 5 });
		expect(pc.get('a')).toEqual({ score: 5 });
		expect(pc.get('nonexistent')).toBeUndefined();
	});

	test('scheduleReconcile は onReconcile を呼ぶ', async () => {
		const onReconcile = vi.fn();
		const pc = new PatchCollection<Item>({
			getServerItems: () => baseItems,
			getId: (item) => item.id,
			reconcileDelayMs: 10,
			onReconcile
		});
		pc.scheduleReconcile();
		expect(onReconcile).not.toHaveBeenCalled();
		await vi.waitFor(() => expect(onReconcile).toHaveBeenCalledOnce());
	});

	test('複数回の scheduleReconcile は最初のタイマーのみ有効', async () => {
		const onReconcile = vi.fn();
		const pc = new PatchCollection<Item>({
			getServerItems: () => baseItems,
			getId: (item) => item.id,
			reconcileDelayMs: 10,
			onReconcile
		});
		pc.scheduleReconcile();
		pc.scheduleReconcile();
		pc.scheduleReconcile();
		await vi.waitFor(() => expect(onReconcile).toHaveBeenCalledOnce());
	});

	test('destroy はタイマーをクリアする', async () => {
		const onReconcile = vi.fn();
		const pc = new PatchCollection<Item>({
			getServerItems: () => baseItems,
			getId: (item) => item.id,
			reconcileDelayMs: 10,
			onReconcile
		});
		pc.scheduleReconcile();
		pc.destroy();
		// タイマーがクリアされているので onReconcile は呼ばれない
		await vi.waitFor(() => expect(onReconcile).not.toHaveBeenCalled(), { timeout: 100 });
	});
});
