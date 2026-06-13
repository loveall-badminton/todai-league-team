<script lang="ts">
	import { GripVertical } from '@lucide/svelte';
	import { createSortable } from '@dnd-kit/svelte/sortable';
	import { cn } from '$lib/utils/cn';

	let {
		side,
		name,
		teamName,
		sideLabel,
		accent,
		index
	}: {
		side: 'A' | 'B';
		name: string;
		teamName?: string | null;
		sideLabel: '左' | '右';
		accent: 'emerald' | 'sky';
		index: number;
	} = $props();

	const sortable = createSortable({
		get id() {
			return side;
		},
		get index() {
			return index;
		}
	});
</script>

<div
	{@attach sortable.attach}
	class={cn(
		'min-h-24 rounded-xl border bg-white p-3 transition-colors',
		sortable.isDragging ? 'border-dashed opacity-60' : 'hover:bg-zinc-50',
		sortable.isDropTarget &&
			(accent === 'emerald' ? 'border-emerald-400 bg-emerald-50' : 'border-sky-400 bg-sky-50'),
		!sortable.isDropTarget && (accent === 'emerald' ? 'border-emerald-200' : 'border-sky-200')
	)}
>
	<div class="mb-2 flex items-center justify-between gap-2">
		<span
			class={cn(
				'rounded-full px-2 py-0.5 text-xs font-bold',
				accent === 'emerald' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
			)}>{sideLabel}</span
		>
		<div
			{@attach sortable.attachHandle}
			class="flex h-8 w-8 cursor-grab items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-100 hover:text-zinc-500 active:cursor-grabbing"
		>
			<GripVertical class="h-4 w-4" />
		</div>
	</div>
	<p class="truncate text-sm font-semibold text-zinc-950">{name}</p>
	{#if teamName}
		<p class="mt-0.5 truncate text-xs text-zinc-400">{teamName}</p>
	{/if}
</div>
