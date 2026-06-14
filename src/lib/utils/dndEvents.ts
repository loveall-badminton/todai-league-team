import { DragDropProvider } from '@dnd-kit/svelte';
import type { ComponentProps } from 'svelte';

export type DragOverEvent = Parameters<
	NonNullable<ComponentProps<typeof DragDropProvider>['onDragOver']>
>[0];

export type DragEndEvent = Parameters<
	NonNullable<ComponentProps<typeof DragDropProvider>['onDragEnd']>
>[0];
