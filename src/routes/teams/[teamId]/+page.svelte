<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { DragDropProvider } from '@dnd-kit/svelte';
	import { isSortable } from '@dnd-kit/svelte/sortable';
	import type { ComponentProps } from 'svelte';
	type DragOverEvent = Parameters<
		NonNullable<ComponentProps<typeof DragDropProvider>['onDragOver']>
	>[0];
	type DragEndEvent = Parameters<
		NonNullable<ComponentProps<typeof DragDropProvider>['onDragEnd']>
	>[0];
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import GroupBadge from '$lib/components/GroupBadge.svelte';
	import DeleteConfirmDialog from '$lib/components/DeleteConfirmDialog.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SortablePlayerItem from './SortablePlayerItem.svelte';
	import type { PageProps } from './$types';
	import {
		updateTeam,
		createPlayer,
		updatePlayer,
		reorderPlayers,
		deletePlayer,
		deleteTeam
	} from './team.remote';

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

	let { data }: PageProps = $props();

	let teamGroupCode = $derived(data.team.groupCode ?? '');
	let teamStatus = $derived(data.team.status);
	let newPlayerGender = $state('unknown');
	let players = $derived([...data.players]);
	let snapshot: typeof players = [];

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
		await reorderPlayers({ ids: players.map((p) => p.id) });
	}
</script>

<svelte:head>
	<title>{data.team.name} | チーム | 東大リーグ団体戦</title>
</svelte:head>

{#snippet headerActions()}
	<div class="flex items-center gap-3">
		<GroupBadge groupCode={data.team.groupCode} />
		{#if data.team.status === 'withdrawn'}
			<span
				class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700"
			>
				棄権
			</span>
		{/if}
	</div>
{/snippet}

<!-- Header -->
<header>
	<a
		href={resolve('/teams')}
		class="mb-2 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-950"
	>
		← チーム一覧
	</a>
	<PageHeader title={data.team.name} actions={headerActions} />
</header>

{#if updateTeam.result?.message}
	<div class="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
		{updateTeam.result.message}
	</div>
{/if}

<!-- Team edit form -->
<section class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-base font-semibold text-zinc-950">チーム情報</h2>
		<DeleteConfirmDialog
			onConfirm={async () => {
				try {
					await deleteTeam();
				} catch (e) {
					// redirect will throw, ignore
				}
			}}
			triggerLabel="チームを削除"
			title="チームを削除しますか？"
			description={`「${data.team.name}」と所属選手のデータをすべて削除します。この操作は取り消せません。`}
		/>
	</div>
	<form {...updateTeam} class="space-y-4">
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<div class="lg:col-span-1">
				<label class="block">
					<span class="text-xs font-medium tracking-wide text-zinc-500">チーム名 *</span>
					<AppInput name="name" value={data.team.name} required class="mt-1" />
				</label>
			</div>
			<div>
				<label class="block">
					<span class="text-xs font-medium tracking-wide text-zinc-500">略称</span>
					<AppInput name="shortName" value={data.team.shortName ?? ''} class="mt-1" />
				</label>
			</div>
			<div>
				<label class="block">
					<span class="text-xs font-medium tracking-wide text-zinc-500">リーグ</span>
					<AppSelect
						name="groupCode"
						bind:value={teamGroupCode}
						items={groupCodeItems}
						placeholder="未割当"
						class="mt-1"
					/>
				</label>
			</div>
		</div>
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<div>
				<label class="block">
					<span class="text-xs font-medium tracking-wide text-zinc-500">状態</span>
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
<section class="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
	<div class="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
		<h2 class="text-base font-semibold text-zinc-950">
			選手
			<span class="ml-1.5 text-sm font-normal text-zinc-400">{players.length}名</span>
		</h2>
	</div>

	<!-- Add player form -->
	<div class="border-b border-zinc-100 bg-zinc-50 px-4 py-4">
		<p class="mb-3 text-xs font-medium tracking-wide text-zinc-500">選手追加</p>
		<form {...createPlayer} class="flex flex-wrap items-end gap-3">
			<div class="min-w-36 flex-1">
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
		{#if createPlayer.result?.message}
			<div class="mt-2 text-sm text-emerald-700">{createPlayer.result.message}</div>
		{/if}
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
					<SortablePlayerItem
						{player}
						{index}
						updatePlayerForm={updatePlayer.for(player.id)}
						onDeleteConfirm={async () => {
							try {
								await deletePlayer({ id: player.id });
								await invalidateAll();
							} catch (e) {
								// ignore
							}
						}}
					/>
				{/each}
			</div>
		</DragDropProvider>
	{/if}
</section>
