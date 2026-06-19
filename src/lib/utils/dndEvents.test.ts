import { beforeEach, describe, expect, test, vi } from 'vitest';

// isSortable はランタイム依存なのでモックする
vi.mock('@dnd-kit/svelte/sortable', () => ({
	isSortable: vi.fn(() => true)
}));

import { isSortable } from '@dnd-kit/svelte/sortable';
import type { DragOverEvent, DragEndEvent } from './dndEvents';
import { createSortableHandlers } from './dndEvents';

const mockIsSortable = vi.mocked(isSortable);

type Item = { id: string; label: string };

/**
 * onDragOver に渡すモックイベント。
 * source.index と target.index を持ち、isSortable が true を返す前提。
 */
function makeDragOverEvent(sourceIndex: number, targetIndex: number) {
	return {
		operation: {
			source: { index: sourceIndex },
			target: { index: targetIndex }
		}
	} as unknown as DragOverEvent;
}

function makeDragEndEvent(canceled: boolean) {
	return { canceled } as unknown as DragEndEvent;
}

describe('createSortableHandlers', () => {
	let items: Item[];
	let committed: string[];
	let handlers: ReturnType<typeof createSortableHandlers<Item>>;

	beforeEach(() => {
		items = [
			{ id: '1', label: 'First' },
			{ id: '2', label: 'Second' },
			{ id: '3', label: 'Third' }
		];
		committed = [];
		handlers = createSortableHandlers(
			() => items,
			(v) => {
				items = v;
			},
			async (ids) => {
				committed.push(ids.join(','));
			}
		);
		mockIsSortable.mockReturnValue(true);
	});

	// ─── onDragStart ─────────────────────────────────────────────────────────

	describe('onDragStart', () => {
		test('captures snapshot so cancel can restore original order', async () => {
			handlers.onDragStart();
			// ドラッグ中に並び順を変える
			handlers.onDragOver(makeDragOverEvent(0, 2));
			expect(items.map((i) => i.id)).toEqual(['2', '3', '1']);
			// キャンセルで元に戻る
			await handlers.onDragEnd(makeDragEndEvent(true));
			expect(items.map((i) => i.id)).toEqual(['1', '2', '3']);
		});

		test('snapshot is fresh each time onDragStart is called', async () => {
			handlers.onDragStart();
			handlers.onDragOver(makeDragOverEvent(0, 1));
			// 再度 dragStart（2回目）でスナップショットが更新される
			handlers.onDragStart();
			handlers.onDragOver(makeDragOverEvent(0, 2));
			await handlers.onDragEnd(makeDragEndEvent(true));
			// 2回目の開始時点の順序（2,1,3）に戻る
			expect(items.map((i) => i.id)).toEqual(['2', '1', '3']);
		});
	});

	// ─── onDragOver ──────────────────────────────────────────────────────────

	describe('onDragOver', () => {
		test('moves item forward (index 0 → 2)', () => {
			handlers.onDragOver(makeDragOverEvent(0, 2));
			expect(items.map((i) => i.id)).toEqual(['2', '3', '1']);
		});

		test('moves item backward (index 2 → 0)', () => {
			handlers.onDragOver(makeDragOverEvent(2, 0));
			expect(items.map((i) => i.id)).toEqual(['3', '1', '2']);
		});

		test('moves item one step forward (index 0 → 1)', () => {
			handlers.onDragOver(makeDragOverEvent(0, 1));
			expect(items.map((i) => i.id)).toEqual(['2', '1', '3']);
		});

		test('moves item one step backward (index 1 → 0)', () => {
			handlers.onDragOver(makeDragOverEvent(1, 0));
			expect(items.map((i) => i.id)).toEqual(['2', '1', '3']);
		});

		test('no-op when source index equals target index', () => {
			const before = [...items];
			handlers.onDragOver(makeDragOverEvent(1, 1));
			expect(items).toEqual(before);
		});

		test('no-op when isSortable returns false for source', () => {
			mockIsSortable.mockReturnValue(false);
			const before = [...items];
			handlers.onDragOver(makeDragOverEvent(0, 2));
			expect(items).toEqual(before);
		});

		test('sequential moves compose correctly', () => {
			handlers.onDragOver(makeDragOverEvent(0, 1));
			handlers.onDragOver(makeDragOverEvent(0, 2));
			// 1st: [2,1,3], 2nd: [1,3,2]
			expect(items.map((i) => i.id)).toEqual(['1', '3', '2']);
		});
	});

	// ─── onDragEnd (confirmed) ───────────────────────────────────────────────

	describe('onDragEnd: confirmed drag', () => {
		test('calls onCommit with current item ids in new order', async () => {
			handlers.onDragStart();
			handlers.onDragOver(makeDragOverEvent(0, 2));
			await handlers.onDragEnd(makeDragEndEvent(false));
			expect(committed).toHaveLength(1);
			expect(committed[0]).toBe('2,3,1');
		});

		test('calls onCommit with unchanged order when no move occurred', async () => {
			handlers.onDragStart();
			await handlers.onDragEnd(makeDragEndEvent(false));
			expect(committed[0]).toBe('1,2,3');
		});

		test('items remain in new order after confirmed drag', async () => {
			handlers.onDragStart();
			handlers.onDragOver(makeDragOverEvent(0, 1));
			await handlers.onDragEnd(makeDragEndEvent(false));
			expect(items.map((i) => i.id)).toEqual(['2', '1', '3']);
		});
	});

	// ─── onDragEnd (canceled) ────────────────────────────────────────────────

	describe('onDragEnd: canceled drag', () => {
		test('restores items to snapshot when canceled', async () => {
			handlers.onDragStart();
			handlers.onDragOver(makeDragOverEvent(0, 2));
			await handlers.onDragEnd(makeDragEndEvent(true));
			expect(items.map((i) => i.id)).toEqual(['1', '2', '3']);
		});

		test('does NOT call onCommit when canceled', async () => {
			handlers.onDragStart();
			handlers.onDragOver(makeDragOverEvent(0, 2));
			await handlers.onDragEnd(makeDragEndEvent(true));
			expect(committed).toHaveLength(0);
		});

		test('restores after multiple moves', async () => {
			handlers.onDragStart();
			handlers.onDragOver(makeDragOverEvent(0, 1));
			handlers.onDragOver(makeDragOverEvent(1, 2));
			await handlers.onDragEnd(makeDragEndEvent(true));
			expect(items.map((i) => i.id)).toEqual(['1', '2', '3']);
		});
	});

	// ─── generic T constraint ────────────────────────────────────────────────

	describe('works with various item shapes', () => {
		test('single-element list: no-op on move', () => {
			const singleItems = [{ id: 'only' }];
			const h = createSortableHandlers(
				() => singleItems,
				() => {},
				async () => {}
			);
			h.onDragOver(makeDragOverEvent(0, 0));
			expect(singleItems).toHaveLength(1);
		});

		test('ids are passed to onCommit in correct order', async () => {
			const result: string[] = [];
			const fourItems = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
			let list = [...fourItems];
			const h = createSortableHandlers(
				() => list,
				(v) => {
					list = v;
				},
				async (ids) => {
					result.push(...ids);
				}
			);
			h.onDragStart();
			h.onDragOver(makeDragOverEvent(3, 0));
			await h.onDragEnd(makeDragEndEvent(false));
			expect(result).toEqual(['d', 'a', 'b', 'c']);
		});
	});
});
