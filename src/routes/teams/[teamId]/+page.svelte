<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { DragDropProvider } from '@dnd-kit/svelte';
	import { onMount } from 'svelte';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppTabs from '$lib/components/AppTabs.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import AppTextarea from '$lib/components/AppTextarea.svelte';
	import Card from '$lib/components/Card.svelte';
	import FormToast from '$lib/components/FormToast.svelte';
	import GroupBadge from '$lib/components/GroupBadge.svelte';
	import DeleteConfirmDialog from '$lib/components/DeleteConfirmDialog.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import SortablePlayerItem from './SortablePlayerItem.svelte';
	import type { PageProps } from './$types';
	import { toast } from 'svelte-sonner';
	import {
		updateTeam,
		createPlayer,
		bulkCreatePlayers,
		reorderPlayers,
		deletePlayer,
		deleteTeam
	} from './team.remote';
	import { createSortableHandlers } from '$lib/utils/dndEvents';

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

	let players = $derived([...data.players]);

	onMount(() => {
		updateTeam.fields.set({
			name: data.team.name,
			shortName: data.team.shortName ?? '',
			groupCode: data.team.groupCode ?? '',
			status: data.team.status
		});
		createPlayer.fields.set({ name: '', gender: 'unknown' });
	});

	// Add player tab state
	let addTab = $state<'single' | 'bulk'>('single');
	let bulkNamesText = $state('');
	let bulkLoading = $state(false);

	async function handleBulkCreate() {
		if (!bulkNamesText.trim()) return;
		bulkLoading = true;
		try {
			const result = await bulkCreatePlayers({
				namesText: bulkNamesText,
				gender: 'unknown'
			});
			toast.success(`${result.addedCount}名の選手を追加しました`);
			bulkNamesText = '';
			await invalidateAll();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : '一括登録に失敗しました');
		} finally {
			bulkLoading = false;
		}
	}

	const { onDragStart, onDragOver, onDragEnd } = createSortableHandlers(
		() => players,
		(v) => {
			players = v;
		},
		(ids) => reorderPlayers({ ids })
	);
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

<!-- Team edit form -->
<Card class="p-5">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-base font-semibold text-zinc-950">チーム情報</h2>
		<DeleteConfirmDialog
			onConfirm={async () => {
				await deleteTeam();
			}}
			triggerLabel="チームを削除"
			title="チームを削除しますか？"
			description={`「${data.team.name}」と所属選手のデータをすべて削除します。この操作は取り消せません。`}
		/>
	</div>
	<form {...updateTeam} class="space-y-4">
		<FormToast result={updateTeam.result} />
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<div class="lg:col-span-1">
				<label class="block">
					<span class="text-xs font-medium tracking-wide text-zinc-500">チーム名 *</span>
					<AppInput {...updateTeam.fields.name.as('text')} required class="mt-1" />
				</label>
			</div>
			<div>
				<label class="block">
					<span class="text-xs font-medium tracking-wide text-zinc-500">略称</span>
					<AppInput {...updateTeam.fields.shortName.as('text')} class="mt-1" />
				</label>
			</div>
			<div>
				<label class="block">
					<span class="text-xs font-medium tracking-wide text-zinc-500">リーグ</span>
					<AppSelect
						{...updateTeam.fields.groupCode.as('select')}
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
					<AppSelect {...updateTeam.fields.status.as('select')} items={statusItems} class="mt-1" />
				</label>
			</div>
			<div class="flex items-end">
				<AppButton type="submit">保存</AppButton>
			</div>
		</div>
	</form>
</Card>

<!-- Players section -->
<Card class="overflow-hidden">
	<div class="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
		<h2 class="text-base font-semibold text-zinc-950">
			選手
			<span class="ml-1.5 text-sm font-normal text-zinc-400">{players.length}名</span>
		</h2>
		{#if players.length > 0}
			<CopyButton text={players.map((p) => p.name).join('\n')} />
		{/if}
	</div>

	<!-- Add player form -->
	<div class="border-b border-zinc-100 bg-zinc-50 px-4 py-4">
		<AppTabs
			bind:value={addTab}
			items={[
				{ value: 'single', label: '1人ずつ追加' },
				{ value: 'bulk', label: '一括登録' }
			]}
			listClass="mb-4"
		/>

		{#if addTab === 'single'}
			<form {...createPlayer} class="flex flex-wrap items-end gap-3">
				<FormToast result={createPlayer.result} />
				<div class="min-w-36 flex-1">
					<label class="block">
						<span class="text-xs font-medium text-zinc-500">氏名 *</span>
						<AppInput
							{...createPlayer.fields.name.as('text')}
							required
							placeholder="例: 山田太郎"
							class="mt-1"
						/>
					</label>
				</div>
				<div class="w-28">
					<label class="block">
						<span class="text-xs font-medium text-zinc-500">性別</span>
						<AppSelect
							{...createPlayer.fields.gender.as('select')}
							items={genderItems}
							class="mt-1"
						/>
					</label>
				</div>
				<AppButton type="submit">追加</AppButton>
			</form>
		{:else if addTab === 'bulk'}
			<div class="space-y-3">
				<label class="block">
					<span class="text-xs font-medium text-zinc-500">選手名（1行に1人）</span>
					<AppTextarea
						bind:value={bulkNamesText}
						rows={8}
						placeholder="山田太郎
鈴木花子
田中一郎"
						class="mt-1 font-mono text-sm"
					/>
				</label>
				{#if bulkNamesText.trim()}
					{@const lineCount = bulkNamesText.split('\n').filter((l) => l.trim()).length}
					<p class="text-xs text-zinc-400">{lineCount}名を追加します</p>
				{/if}
				<AppButton onclick={handleBulkCreate} disabled={bulkLoading || !bulkNamesText.trim()}>
					{bulkLoading ? '登録中…' : '一括登録'}
				</AppButton>
			</div>
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
						onDeleteConfirm={async () => {
							await deletePlayer({ id: player.id });
							await invalidateAll();
						}}
					/>
				{/each}
			</div>
		</DragDropProvider>
	{/if}
</Card>
