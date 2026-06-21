<script lang="ts">
	import { GripVertical, Pencil } from '@lucide/svelte';
	import { createSortable } from '@dnd-kit/svelte/sortable';
	import { genderLabel } from '$lib/domain/tokyoLeagueLabels';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import type { TeamPlayer } from '$lib/server/repositories/tokyoLeagueRepository';
	import { updatePlayer } from './team.remote';

	let {
		player,
		index,
		onDeleteConfirm
	}: {
		player: TeamPlayer;
		index: number;
		onDeleteConfirm?: () => void | Promise<void>;
	} = $props();

	const sortable = createSortable({
		get id() {
			return player.id;
		},
		get index() {
			return index;
		}
	});

	let isEditing = $state(false);

	const genderItems = [
		{ value: 'unknown', label: '未設定' },
		{ value: 'male', label: '男性' },
		{ value: 'female', label: '女性' }
	];
	const statusItems = [
		{ value: 'active', label: '出場可' },
		{ value: 'inactive', label: '不可' }
	];

	let editGender = $state('unknown' as string);
	let editStatus = $state('active' as string);

	function startEditing() {
		editGender = player.gender;
		editStatus = player.status;
		isEditing = true;
	}
</script>

<div
	{@attach sortable.attach}
	class="px-4 transition-colors {sortable.isDragging ? 'opacity-40' : ''}"
>
	{#if !isEditing}
		<div class="flex w-full items-center gap-2 py-3">
			<!-- Drag handle -->
			<div
				{@attach sortable.attachHandle}
				class="shrink-0 cursor-grab text-zinc-300 hover:text-muted-foreground"
			>
				<GripVertical class="h-4 w-4" />
			</div>
			<button
				type="button"
				onclick={startEditing}
				class="-mx-1 flex flex-1 items-center gap-3 rounded-lg px-1 text-left transition-colors hover:bg-zinc-50"
			>
				<span
					class="h-2 w-2 shrink-0 rounded-full {player.gender === 'male'
						? 'bg-sky-400'
						: player.gender === 'female'
							? 'bg-rose-400'
							: 'bg-zinc-300'}"
					title={genderLabel(player.gender)}
				></span>
				<div class="min-w-0 flex-1">
					<p class="text-sm font-medium text-default">{player.name}</p>
				</div>
				<div class="flex shrink-0 items-center gap-2">
					{#if player.status === 'inactive'}
						<span
							class="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-muted-foreground"
							>不可</span
						>
					{:else}
						<span
							class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
							>出場可</span
						>
					{/if}
					<Pencil class="h-4 w-4 text-zinc-300" />
				</div>
			</button>
		</div>
	{:else}
		<div class="space-y-3 py-3">
			<form
				{...updatePlayer.for(player.id).enhance(async (form) => {
					try {
						const result = await form.submit();

						if (result) {
							isEditing = false;
						}
					} catch (error) {
						console.error(error);
					}
				})}
				class="space-y-3"
			>
				<input type="hidden" name="id" value={player.id} />
				<div class="flex flex-wrap gap-3">
					<div class="min-w-32 flex-1">
						<label class="block">
							<span class="text-xs font-medium text-muted-foreground">氏名 *</span>
							<AppInput name="name" value={player.name} required class="mt-1" />
						</label>
					</div>
					<div class="w-28">
						<label class="block">
							<span class="text-xs font-medium text-muted-foreground">性別</span>
							<AppSelect name="gender" bind:value={editGender} items={genderItems} class="mt-1" />
						</label>
					</div>
					<div class="w-24">
						<label class="block">
							<span class="text-xs font-medium text-muted-foreground">状態</span>
							<AppSelect name="status" bind:value={editStatus} items={statusItems} class="mt-1" />
						</label>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<AppButton type="submit">保存</AppButton>
					<AppButton type="button" variant="secondary" onclick={() => (isEditing = false)}
						>キャンセル</AppButton
					>
				</div>
			</form>
			<ConfirmDialog
				onConfirm={onDeleteConfirm}
				triggerLabel="選手を削除"
				triggerClass="text-xs text-red-500 hover:text-red-700 hover:underline"
				triggerVariant="ghost"
				title="選手を削除しますか？"
				description={`「${player.name}」を削除します。この操作は取り消せません。`}
				confirmVariant="danger"
				confirmLabel="削除する"
			/>
		</div>
	{/if}
</div>
