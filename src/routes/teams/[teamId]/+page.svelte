<script lang="ts">
	import { resolve } from '$app/paths';
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
	import GroupBadge from '$lib/components/GroupBadge.svelte';
	import DeleteConfirmDialog from '$lib/components/DeleteConfirmDialog.svelte';
	import SortablePlayerItem from './SortablePlayerItem.svelte';
	import type { PageProps } from './$types';

	const groupCodeItems = [
		{ value: '', label: '未割当' },
		{ value: 'A', label: 'Aリーグ' },
		{ value: 'B', label: 'Bリーグ' }
	];
	const statusItems = [
		{ value: 'active', label: '出場' },
		{ value: 'withdrawn', label: '棄権' }
	];
	const genderItems = [
		{ value: 'unknown', label: '未設定' },
		{ value: 'male', label: '男性' },
		{ value: 'female', label: '女性' }
	];

	let { data, form }: PageProps = $props();

	let teamGroupCode = $state('');
	let teamStatus = $state('active' as string);
	let newPlayerGender = $state('unknown');

	$effect(() => {
		teamGroupCode = data.team.groupCode ?? '';
		teamStatus = data.team.status;
	});

	let players = $state(untrack(() => [...data.players]));
	let snapshot: typeof players = [];

	$effect(() => {
		players = [...data.players];
	});

	function onDragStart() {
		snapshot = players.slice();
	}

	function onDragOver(event: DragOverEvent) {
		const { source, target } = event.operation;
		if (isSortable(source) && isSortable(target) && source.index !== target.index) {
			const next = [...players];
			const [moved] = next.splice(source.index, 1);
			next.splice(target.index, 0, moved);
			players = next;
		}
	}

	async function onDragEnd(event: DragEndEvent) {
		if (event.canceled) {
			players = snapshot;
			return;
		}
		const fd = new FormData();
		fd.set('ids', JSON.stringify(players.map((p) => p.id)));
		await fetch('?/reorderPlayers', {
			method: 'POST',
			headers: { accept: 'application/json', 'x-sveltekit-action': 'true' },
			body: fd
		});
	}
</script>

<svelte:head>
	<title>{data.team.name} | チーム | 東大リーグ団体戦</title>
</svelte:head>

<div class="px-4 py-6 sm:px-6">
	<div class="mx-auto max-w-6xl space-y-5">

		<!-- Header -->
		<header>
			<a
				href={resolve('/teams')}
				class="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-950 mb-2"
			>
				← チーム一覧
			</a>
			<div class="flex items-center gap-3 flex-wrap">
				<h1 class="text-2xl font-bold text-zinc-950">{data.team.name}</h1>
				<GroupBadge groupCode={data.team.groupCode} />
				{#if data.team.status === 'withdrawn'}
					<span
						class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-700"
						>棄権</span
					>
				{/if}
			</div>
		</header>

		<FormMessage message={form?.message} />

		<!-- Team edit form -->
		<section class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-base font-semibold text-zinc-950">チーム情報</h2>
				<DeleteConfirmDialog
					formAction="?/deleteTeam"
					triggerLabel="チームを削除"
					title="チームを削除しますか？"
					description={`「${data.team.name}」と所属選手のデータをすべて削除します。この操作は取り消せません。`}
				/>
			</div>
			<form method="POST" action="?/updateTeam" class="space-y-4">
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<div class="lg:col-span-1">
						<label class="block">
							<span class="text-xs font-medium uppercase tracking-wide text-zinc-500">チーム名 *</span>
							<AppInput name="name" value={data.team.name} required class="mt-1" />
						</label>
					</div>
					<div>
						<label class="block">
							<span class="text-xs font-medium uppercase tracking-wide text-zinc-500">略称</span>
							<AppInput name="shortName" value={data.team.shortName ?? ''} class="mt-1" />
						</label>
					</div>
					<div>
						<label class="block">
							<span class="text-xs font-medium uppercase tracking-wide text-zinc-500">リーグ</span>
							<AppSelect name="groupCode" bind:value={teamGroupCode} items={groupCodeItems} placeholder="未割当" class="mt-1" />
						</label>
					</div>
				</div>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<div>
						<label class="block">
							<span class="text-xs font-medium uppercase tracking-wide text-zinc-500">状態</span>
							<AppSelect name="status" bind:value={teamStatus} items={statusItems} class="mt-1" />
						</label>
					</div>
					<div class="flex items-end">
						<AppButton type="submit">保存</AppButton>
					</div>
				</div>
			</form>
		</section>

		<!-- Players section -->
		<section class="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
			<div class="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
				<h2 class="text-base font-semibold text-zinc-950">
					選手
					<span class="ml-1.5 text-sm font-normal text-zinc-400">{players.length}名</span>
				</h2>
			</div>

			<!-- Add player form -->
			<div class="border-b border-zinc-100 bg-zinc-50 px-4 py-4">
				<p class="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-3">選手追加</p>
				<form method="POST" action="?/createPlayer" class="flex flex-wrap items-end gap-3">
					<div class="flex-1 min-w-36">
						<label class="block">
							<span class="text-xs font-medium text-zinc-500">氏名 *</span>
							<AppInput name="name" required placeholder="例: 山田太郎" class="mt-1" />
						</label>
					</div>
					<div class="w-28">
						<label class="block">
							<span class="text-xs font-medium text-zinc-500">性別</span>
							<AppSelect name="gender" bind:value={newPlayerGender} items={genderItems} class="mt-1" />
						</label>
					</div>
					<AppButton type="submit">追加</AppButton>
				</form>
			</div>

			<!-- Player list -->
			{#if players.length === 0}
				<div class="p-8 text-center">
					<p class="text-sm text-zinc-400">選手はまだ登録されていません</p>
				</div>
			{:else}
				<DragDropProvider {onDragStart} {onDragOver} {onDragEnd}>
					<div class="divide-y divide-zinc-100">
						{#each players as player, index (player.id)}
							<SortablePlayerItem {player} {index} />
						{/each}
					</div>
				</DragDropProvider>
			{/if}
		</section>

	</div>
</div>
