<script lang="ts">
	import { resolve } from '$app/paths';
	import Card from '$lib/components/Card.svelte';
	import { RUBBER_DEFINITIONS, type RubberCode } from '$lib/domain/tokyoLeague';
	import { rubberLabel, submissionStatusLabel } from '$lib/domain/tokyoLeagueLabels';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import type { PageProps } from './$types';
	import { lineup } from './lineup.remote';
	import {
		lineupStatusBadgeClass,
		filteredPlayers as _filteredPlayers,
		slotLabel,
		savedPlayerValue
	} from './lineupHelpers';
	import AppButton from '$lib/components/AppButton.svelte';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';
	import {
		clearLocalLineupDraft,
		lineupDraftItemsFromFormData,
		loadLocalLineupDraft,
		saveLocalLineupDraft,
		type LocalLineupDraftItem
	} from '../lineupDraftStorage';

	let { data }: PageProps = $props();

	type Player = { id: string; name: string; gender: string };
	type Item = { rubberCode: string; player1Id: string | null; player2Id: string | null };

	let status = $derived(data.submission?.status ?? null);
	let isLocked = $derived(status === 'locked' || status === 'revealed');
	let isSubmitted = $derived(status === 'submitted');

	const savedValue = (code: string, order: 1 | 2) => savedPlayerValue(code, order, data.items);

	const playerName = (id: string) => data.players.find((p: Player) => p.id === id)?.name ?? id;

	const statusBadgeClass = lineupStatusBadgeClass;
	let draftItems = $state(initialDraftItems());

	const lineupForm = lineup.enhance(async (form) => {
		try {
			if (await form.submit()) {
				clearLocalLineupDraft(data.tie.id, data.team.id);
				toastResult(form.result);
			} else {
				toastIssues(form);
			}
		} catch (error) {
			toastError(error);
		}
	});

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

	function toastResult(result: { message?: string; warnings?: string[] } | undefined) {
		if (!result?.message) {
			toast.success('オーダーを提出しました');
			return;
		}

		if (result.warnings?.length) {
			toast.warning(result.message, { description: result.warnings.join('\n') });
			return;
		}

		toast.success(result.message);
	}

	function toastIssues(form: { fields: { allIssues: () => { message: string }[] | undefined } }) {
		const issues = (form.fields.allIssues() ?? []).map((issue) => issue.message);
		if (issues.length === 0) {
			toast.error('送信内容に問題があります');
			return;
		}

		toast.error(issues[0], { description: issues.slice(1).join('\n') || undefined });
	}

	function toastError(error: unknown) {
		const message = errorMessage(error);
		const [title, ...details] = message.split('\n');
		toast.error(title || 'エラーが発生しました', { description: details.join('\n') || undefined });
	}

	function errorMessage(error: unknown) {
		if (error instanceof Error && error.message) return error.message;
		if (typeof error === 'object' && error && 'body' in error) {
			const body = (error as { body?: { message?: unknown } }).body;
			if (typeof body?.message === 'string') return body.message;
		}
		if (typeof error === 'object' && error && 'message' in error) {
			const message = (error as { message?: unknown }).message;
			if (typeof message === 'string') return message;
		}
		return 'エラーが発生しました';
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
		class="text-sm text-zinc-500 hover:text-zinc-700"
		href={resolve('/ties/[tieId]', { tieId: data.tie.id })}
	>
		← {data.tie.tieCode}
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
		<div class="border-b border-zinc-100 px-5 py-4">
			<p class="text-sm text-zinc-500">
				{status === 'revealed'
					? 'オーダーが公開されました。'
					: 'オーダーは承認済みです。変更する場合は運営にお問い合わせください。'}
			</p>
		</div>
		<div class="divide-y divide-zinc-100">
			{#each RUBBER_DEFINITIONS as rubber (rubber.code)}
				{@const item = data.items.find((i: Item) => i.rubberCode === rubber.code)}
				<div class="grid grid-cols-[8rem_1fr] gap-3 px-5 py-3.5">
					<p class="pt-0.5 text-xs font-medium text-zinc-500">{rubberLabel(rubber.code)}</p>
					<div class="space-y-0.5">
						{#if item?.player1Id}
							<p class="text-sm">{playerName(item.player1Id)}</p>
						{:else}
							<p class="text-sm text-zinc-400">未入力</p>
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
		<div class="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
			<p class="text-sm text-zinc-400">選手が登録されていません</p>
		</div>
	{:else}
		<Card class="overflow-hidden">
			<form {...lineupForm} class="divide-y divide-zinc-100">
				{#each RUBBER_DEFINITIONS as rubber, index (rubber.code)}
					{@const itemField = lineup.fields.items[index]}
					<div class="px-5 py-4">
						<input {...itemField.rubberCode.as('hidden', rubber.code)} />
						<p class="mb-2.5 text-xs font-medium text-zinc-500">{rubberLabel(rubber.code)}</p>
						<div class="grid grid-cols-2 gap-2">
							{#each [1, 2] as order (order)}
								{@const typedOrder = order as 1 | 2}
								{@const slotPlayers = filteredPlayers(rubber.discipline, typedOrder)}
								{@const playerItems = [
									{ value: '', label: '未入力' },
									...slotPlayers.map((p) => ({ value: p.id, label: p.name }))
								]}
								<div>
									<span class="mb-1 block text-xs text-zinc-400">
										{slotLabel(rubber.discipline, typedOrder)}
									</span>
									{#if typedOrder === 1}
										<AppSelect
											{...itemField.player1Id.as('select', draftValue(rubber.code, 1))}
											items={playerItems}
											placeholder="未入力"
										/>
									{:else}
										<AppSelect
											{...itemField.player2Id.as('select', draftValue(rubber.code, 2))}
											items={playerItems}
											placeholder="未入力"
										/>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}

				<div class="flex justify-end gap-2 px-5 py-4">
					<AppButton
						type="button"
						disabled={lineup.pending > 0}
						onclick={saveLocalDraft}
						variant="secondary"
					>
						下書き保存
					</AppButton>
					<AppButton type="submit" disabled={lineup.pending > 0}>
						{lineup.pending > 0 ? '送信中…' : '提出する'}
					</AppButton>
				</div>
			</form>
		</Card>
	{/if}
{/if}
