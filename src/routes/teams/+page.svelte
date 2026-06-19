<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import Card from '$lib/components/Card.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { createSortableHandlers } from '$lib/utils/dndEvents';
	import { DragDropProvider } from '@dnd-kit/svelte';
	import { toast } from 'svelte-sonner';
	import type { PageProps } from './$types';
	import SortableTeamItem from './SortableTeamItem.svelte';
	import { create, importTeams, reorder } from './teams.remote';

	const groupCodeItems = [
		{ value: '', label: '未割当' },
		{ value: 'A', label: 'Aリーグ' },
		{ value: 'B', label: 'Bリーグ' }
	];

	let { data }: PageProps = $props();

	let showForm = $state(false);
	let fileInput: HTMLInputElement;

	$effect(() => {
		const result = importTeams.result;
		if (!result?.success) return;
		const { addedCount, createdTeams } = result;
		let msg = `${addedCount}名の選手を追加しました`;
		if (createdTeams.length > 0) {
			msg += `（新規作成チーム: ${createdTeams.join('、')}）`;
		}
		toast.success(msg);
	});

	let teams = $derived([...data.teams]);

	const { onDragStart, onDragOver, onDragEnd } = createSortableHandlers(
		() => teams,
		(v) => {
			teams = v;
		},
		(ids) => reorder({ ids })
	);
</script>

<svelte:head>
	<title>チーム | 東大リーグ団体戦</title>
</svelte:head>

{#snippet headerActions()}
	<form {...importTeams} enctype="multipart/form-data" class="hidden">
		<input
			bind:this={fileInput}
			type="file"
			name="file"
			accept=".csv"
			onchange={(e) => e.currentTarget.form?.requestSubmit()}
		/>
	</form>
	<AppButton type="button" variant="secondary" onclick={() => fileInput.click()}>
		インポート
	</AppButton>
	<AppButton variant="secondary" href="/teams/export">エクスポート</AppButton>
	<AppButton type="button" onclick={() => (showForm = !showForm)}>
		{showForm ? 'キャンセル' : '+ 追加'}
	</AppButton>
{/snippet}

<PageHeader title="チーム" actions={headerActions} />

<!-- Creation form (inline) -->
{#if showForm}
	<Card>
		<h2 class="mb-4 text-base font-semibold text-zinc-950">チーム追加</h2>
		<form {...create} class="space-y-4">
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<div class="lg:col-span-2">
					<label class="block">
						<span class="text-xs font-medium tracking-wide text-zinc-500">チーム名 *</span>
						<AppInput
							{...create.fields.name.as('text')}
							required
							placeholder="例: 東京大学"
							class="mt-1"
						/>
					</label>
				</div>
				<div>
					<label class="block">
						<span class="text-xs font-medium tracking-wide text-zinc-500">略称</span>
						<AppInput {...create.fields.shortName.as('text')} placeholder="例: 東大" class="mt-1" />
					</label>
				</div>
				<div>
					<label class="block">
						<span class="text-xs font-medium tracking-wide text-zinc-500">リーグ</span>
						<AppSelect
							{...create.fields.groupCode.as('select')}
							items={groupCodeItems}
							placeholder="未割当"
							class="mt-1"
						/>
					</label>
				</div>
			</div>
			<div class="flex gap-2">
				<AppButton type="submit">追加</AppButton>
				<AppButton type="button" variant="secondary" onclick={() => (showForm = false)}
					>キャンセル</AppButton
				>
			</div>
		</form>
	</Card>
{/if}

<!-- Team list -->
<Card class="overflow-hidden" flush>
	{#if teams.length === 0}
		<div class="p-10 text-center">
			<p class="text-sm text-zinc-400">チームはまだ登録されていません</p>
			<AppButton type="button" variant="ghost" onclick={() => (showForm = true)}>
				最初のチームを追加する
			</AppButton>
		</div>
	{:else}
		<!-- Desktop header row -->
		<div
			class="hidden border-b border-zinc-100 px-4 py-2.5 lg:grid lg:grid-cols-[auto_1fr_auto_auto_auto_auto]"
		>
			<span class="w-6"></span>
			<span class="text-xs font-medium tracking-wide text-zinc-400">チーム名</span>
			<span class="w-16 text-center text-xs font-medium tracking-wide text-zinc-400">リーグ</span>
			<span class="w-20 text-right text-xs font-medium tracking-wide text-zinc-400">選手</span>
			<span class="w-16 text-center text-xs font-medium tracking-wide text-zinc-400">状態</span>
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
</Card>
