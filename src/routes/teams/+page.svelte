<script lang="ts">
	import { DragDropProvider } from '@dnd-kit/svelte';
	import { isSortable } from '@dnd-kit/svelte/sortable';
	import { untrack } from 'svelte';
	import type { ComponentProps } from 'svelte';
	type DragOverEvent = Parameters<NonNullable<ComponentProps<typeof DragDropProvider>['onDragOver']>>[0];
	type DragEndEvent = Parameters<NonNullable<ComponentProps<typeof DragDropProvider>['onDragEnd']>>[0];
	import FormMessage from '$lib/components/FormMessage.svelte';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import SortableTeamItem from './SortableTeamItem.svelte';
	import type { PageProps } from './$types';

	const groupCodeItems = [
		{ value: '', label: '未割当' },
		{ value: 'A', label: 'Aリーグ' },
		{ value: 'B', label: 'Bリーグ' }
	];

	let newGroupCode = $state('');

	let { data, form }: PageProps = $props();

	let showForm = $state(false);

	let teams = $state(untrack(() => [...data.teams]));
	let snapshot: typeof teams = [];

	$effect(() => {
		teams = [...data.teams];
	});

	function onDragStart() {
		snapshot = teams.slice();
	}

	function onDragOver(event: DragOverEvent) {
		const { source, target } = event.operation;
		if (isSortable(source) && isSortable(target) && source.index !== target.index) {
			const next = [...teams];
			const [moved] = next.splice(source.index, 1);
			next.splice(target.index, 0, moved);
			teams = next;
		}
	}

	async function onDragEnd(event: DragEndEvent) {
		if (event.canceled) {
			teams = snapshot;
			return;
		}
		const fd = new FormData();
		fd.set('ids', JSON.stringify(teams.map((t) => t.id)));
		await fetch('?/reorder', {
			method: 'POST',
			headers: { accept: 'application/json', 'x-sveltekit-action': 'true' },
			body: fd
		});
	}
</script>

<svelte:head>
	<title>チーム | 東大リーグ団体戦</title>
</svelte:head>

<div class="px-4 py-6 sm:px-6">
	<div class="mx-auto max-w-6xl space-y-5">

		<!-- Header -->
		<header class="flex items-center justify-between">
			<h1 class="text-2xl font-bold text-zinc-950">チーム</h1>
			<AppButton type="button" onclick={() => (showForm = !showForm)}>
				{showForm ? 'キャンセル' : '+ 追加'}
			</AppButton>
		</header>

		<!-- Creation form (inline) -->
		{#if showForm}
			<div class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
				<h2 class="text-base font-semibold text-zinc-950 mb-4">チーム追加</h2>
				<FormMessage message={form?.message} />
				<form method="POST" action="?/create" class="space-y-4">
					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<div class="lg:col-span-2">
							<label class="block">
								<span class="text-xs font-medium uppercase tracking-wide text-zinc-500">チーム名 *</span>
								<AppInput name="name" required placeholder="例: 東京大学" class="mt-1" />
							</label>
						</div>
						<div>
							<label class="block">
								<span class="text-xs font-medium uppercase tracking-wide text-zinc-500">略称</span>
								<AppInput name="shortName" placeholder="例: 東大" class="mt-1" />
							</label>
						</div>
						<div>
							<label class="block">
								<span class="text-xs font-medium uppercase tracking-wide text-zinc-500">リーグ</span>
								<AppSelect name="groupCode" bind:value={newGroupCode} items={groupCodeItems} placeholder="未割当" class="mt-1" />
							</label>
						</div>
					</div>
					<div class="flex gap-2">
						<AppButton type="submit">追加</AppButton>
						<AppButton type="button" variant="secondary" onclick={() => (showForm = false)}>キャンセル</AppButton>
					</div>
				</form>
			</div>
		{/if}

		<!-- Team list -->
		<div class="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
			{#if teams.length === 0}
				<div class="p-10 text-center">
					<p class="text-sm text-zinc-400">チームはまだ登録されていません</p>
					<AppButton type="button" variant="ghost" onclick={() => (showForm = true)} class="mt-3 underline underline-offset-2">
						最初のチームを追加する
					</AppButton>
				</div>
			{:else}
				<!-- Desktop header row -->
				<div class="hidden border-b border-zinc-100 px-4 py-2.5 lg:grid lg:grid-cols-[auto_1fr_auto_auto_auto_auto]">
					<span class="w-6"></span>
					<span class="text-xs font-medium uppercase tracking-wide text-zinc-400">チーム名</span>
					<span class="w-16 text-center text-xs font-medium uppercase tracking-wide text-zinc-400">リーグ</span>
					<span class="w-20 text-right text-xs font-medium uppercase tracking-wide text-zinc-400">選手</span>
					<span class="w-16 text-center text-xs font-medium uppercase tracking-wide text-zinc-400">状態</span>
					<span class="w-12"></span>
				</div>

				<DragDropProvider {onDragStart} {onDragOver} {onDragEnd}>
					<div class="divide-y divide-zinc-100">
						{#each teams as team, index (team.id)}
							<SortableTeamItem {team} {index} />
						{/each}
					</div>
				</DragDropProvider>
			{/if}
		</div>

	</div>
</div>
