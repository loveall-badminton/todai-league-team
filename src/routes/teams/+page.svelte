<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import Card from '$lib/components/Card.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { createSortableHandlers } from '$lib/utils/dndEvents';
	import { DragDropProvider } from '@dnd-kit/svelte';
	import { toast } from 'svelte-sonner';
	import type { PageProps } from './$types';
	import SortableTeamItem from './SortableTeamItem.svelte';
	import TeamCreateForm from './TeamCreateForm.svelte';
	import { importTeams, reorder } from './teams.remote';

	const groupCodeItems = [
		{ value: '', label: '未割当' },
		{ value: 'A', label: 'Aリーグ' },
		{ value: 'B', label: 'Bリーグ' }
	];

	let { data }: PageProps = $props();

	let showForm = $state(false);
	let fileInput: HTMLInputElement | undefined;

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
	<AppButton type="button" variant="secondary" onclick={() => fileInput?.click()}>
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
		<h2 class="mb-4 text-base font-semibold text-default">チーム追加</h2>
		<TeamCreateForm {groupCodeItems} onCancel={() => (showForm = false)} />
	</Card>
{/if}

<!-- Team list -->
<Card class="overflow-hidden" flush>
	{#if teams.length === 0}
		<div class="p-10 text-center">
			<p class="text-sm text-muted">チームはまだ登録されていません</p>
			<AppButton type="button" variant="ghost" onclick={() => (showForm = true)}>
				最初のチームを追加する
			</AppButton>
		</div>
	{:else}
		<DragDropProvider {onDragStart} {onDragOver} {onDragEnd}>
			<div class="divide-y divide-zinc-100">
				{#each teams as team, index (team.id)}
					<SortableTeamItem {team} {index} />
				{/each}
			</div>
		</DragDropProvider>
	{/if}
</Card>
