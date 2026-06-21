<script lang="ts">
	import { resolve } from '$app/paths';
	import type { EntityOption } from '$lib/types/entities';
	import { ArrowLeft } from '@lucide/svelte';
	import Card from '$lib/components/Card.svelte';
	import { RUBBER_DEFINITIONS, type RubberCode } from '$lib/domain/tokyoLeague';
	import { rubberLabel, submissionStatusLabel } from '$lib/domain/tokyoLeagueLabels';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import type { PageProps } from './$types';
	import {
		lineupStatusBadgeClass,
		filteredPlayers as _filteredPlayers,
		slotLabel,
		savedPlayerValue
	} from './lineupHelpers';
	import LineupForm from './LineupForm.svelte';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';
	import {
		lineupDraftItemsFromFormData,
		loadLocalLineupDraft,
		saveLocalLineupDraft,
		type LocalLineupDraftItem
	} from '../lineupDraftStorage';

	let { data }: PageProps = $props();

	type Player = EntityOption & { gender: string };
	type Item = { rubberCode: string; player1Id: string | null; player2Id: string | null };

	let status = $derived(data.submission?.status ?? null);
	let isLocked = $derived(status === 'locked' || status === 'revealed');
	let isSubmitted = $derived(status === 'submitted');

	const savedValue = (code: string, order: 1 | 2) => savedPlayerValue(code, order, data.items);

	const playerName = (id: string) => data.players.find((p: Player) => p.id === id)?.name ?? id;

	const statusBadgeClass = lineupStatusBadgeClass;
	let draftItems = $state(initialDraftItems());

	function filteredPlayers(discipline: string, order: 1 | 2): Player[] {
		return _filteredPlayers(discipline, order, data.players);
	}

	function initialDraftItems(): LocalLineupDraftItem[] {
		return RUBBER_DEFINITIONS.map((rubber) => ({
			rubberCode: rubber.code,
			player1Id: savedValue(rubber.code, 1),
			player2Id: savedValue(rubber.code, 2)
		}));
	}

	function draftValue(code: RubberCode, order: 1 | 2) {
		const item = draftItems.find((draftItem) => draftItem.rubberCode === code);
		return order === 1 ? (item?.player1Id ?? '') : (item?.player2Id ?? '');
	}

	function saveLocalDraft(event: MouseEvent) {
		const formElement = (event.currentTarget as HTMLButtonElement | null)?.form;
		if (!formElement) return;

		const items = lineupDraftItemsFromFormData(new FormData(formElement));
		saveLocalLineupDraft(data.tie.id, data.team.id, items);
		draftItems = items;
		toast.success('下書きをこの端末に保存しました');
	}

	onMount(() => {
		const localDraft = loadLocalLineupDraft(data.tie.id, data.team.id);
		if (!localDraft) return;

		draftItems = localDraft;
		toast.info('この端末に保存した下書きを復元しました');
	});
</script>

<svelte:head>
	<title>{data.team.name} オーダー入力 | 東大リーグ団体戦</title>
</svelte:head>

<!-- Header -->
<header>
	<a
		class="text-sm text-muted-foreground hover:text-zinc-700 flex items-center"
		href={resolve('/ties/[tieId]', { tieId: data.tie.id })}
	>
		<ArrowLeft class="size-3" />
		{data.tie.tieCode}
	</a>
	<PageHeader
		title={data.team.name}
		description={data.opponentTeam ? `vs ${data.opponentTeam.name}` : 'オーダー入力'}
	/>
	<span
		class="mt-2 inline-flex rounded-full px-3 py-1 text-sm font-medium {statusBadgeClass(status)}"
	>
		{submissionStatusLabel(status)}
	</span>
</header>

<!-- Locked/revealed: read-only display -->
{#if isLocked}
	<Card class="overflow-hidden">
		<div class="border-b border-border-subtle px-5 py-4">
			<p class="text-sm text-muted-foreground">
				{status === 'revealed'
					? 'オーダーが公開されました。'
					: 'オーダーは承認済みです。変更する場合は運営にお問い合わせください。'}
			</p>
		</div>
		<div class="divide-y divide-zinc-100">
			{#each RUBBER_DEFINITIONS as rubber (rubber.code)}
				{@const item = data.items.find((i: Item) => i.rubberCode === rubber.code)}
				<div class="grid grid-cols-[8rem_1fr] gap-3 px-5 py-3.5">
					<p class="pt-0.5 text-xs font-medium text-muted-foreground">{rubberLabel(rubber.code)}</p>
					<div class="space-y-0.5">
						{#if item?.player1Id}
							<p class="text-sm">{playerName(item.player1Id)}</p>
						{:else}
							<p class="text-sm text-muted">未入力</p>
						{/if}
						{#if item?.player2Id}
							<p class="text-sm">{playerName(item.player2Id)}</p>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</Card>
{:else}
	{#if isSubmitted}
		<div class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
			提出済みです。変更する場合はそのまま編集して再提出してください。
		</div>
	{/if}

	{#if data.players.length === 0}
		<div class="rounded-2xl border border-border bg-white p-8 text-center">
			<p class="text-sm text-muted">選手が登録されていません</p>
		</div>
	{:else}
		<Card class="overflow-hidden">
			<LineupForm
				rubberDefinitions={RUBBER_DEFINITIONS}
				{draftValue}
				{filteredPlayers}
				{slotLabel}
				{rubberLabel}
				onSaveDraft={saveLocalDraft}
				tieId={data.tie.id}
				teamId={data.team.id}
			/>
		</Card>
	{/if}
{/if}
