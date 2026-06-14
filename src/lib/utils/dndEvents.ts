import type { DragDropProvider } from '@dnd-kit/svelte';
import { isSortable } from '@dnd-kit/svelte/sortable';
import type { ComponentProps } from 'svelte';

export type DragOverEvent = Parameters<
	NonNullable<ComponentProps<typeof DragDropProvider>['onDragOver']>
>[0];

export type DragEndEvent = Parameters<
	NonNullable<ComponentProps<typeof DragDropProvider>['onDragEnd']>
>[0];

/**
 * Returns onDragStart/onDragOver/onDragEnd handlers for an optimistic sortable list.
 * Declare the list as $state and pass getter/setter so Svelte reactivity stays intact.
 */
export function createSortableHandlers<T extends { id: string }>(
	getItems: () => T[],
	setItems: (items: T[]) => void,
	onCommit: (ids: string[]) => Promise<void>
) {
	let snapshot: T[] = [];

	return {
		onDragStart() {
			snapshot = getItems().slice();
		},
		onDragOver(event: DragOverEvent) {
			const { source, target } = event.operation;
			if (isSortable(source) && isSortable(target) && source.index !== target.index) {
				const next = [...getItems()];
				const [moved] = next.splice(source.index, 1);
				next.splice(target.index, 0, moved);
				setItems(next);
			}
		},
		async onDragEnd(event: DragEndEvent) {
			if (event.canceled) {
				setItems(snapshot);
				return;
			}
			await onCommit(getItems().map((item) => item.id));
		}
	};
}
