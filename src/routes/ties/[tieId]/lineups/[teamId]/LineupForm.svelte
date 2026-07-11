<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import type { SelectItem } from '$lib/types/ui';
	import { type RubberCode } from '$lib/domain/tokyoLeague';
	import { lineup } from './lineup.remote';
	import { clearLocalLineupDraft, type LocalLineupDraft } from '../lineupDraftStorage';

	type RubberDef = { code: RubberCode; discipline: string };

	let {
		rubberDefinitions,
		draftValue,
		filteredPlayers,
		slotLabel,
		rubberLabel,
		onDraftChange,
		tieId,
		teamId
	}: {
		rubberDefinitions: readonly RubberDef[];
		draftValue: (code: RubberCode, order: 1 | 2) => string;
		filteredPlayers: (discipline: string, order: 1 | 2) => { id: string; name: string }[];
		slotLabel: (discipline: string, order: 1 | 2) => string;
		rubberLabel: (code: RubberCode) => string;
		onDraftChange: (
			items: { rubberCode: string; player1Id: string | null; player2Id: string | null }[]
		) => void;
		tieId: string;
		teamId: string;
	} = $props();

	const enhancedForm = lineup.enhance(async (form) => {
		try {
			if (await form.submit()) {
				clearLocalLineupDraft(tieId, teamId);
				toastResult(form.result);
			} else {
				toastIssues(form);
			}
		} catch (error) {
			toastError(error);
		}
	});

	let draftItems: LocalLineupDraft = $derived(
		rubberDefinitions.map((rubber) => ({
			rubberCode: rubber.code,
			player1Id: draftValue(rubber.code, 1),
			player2Id: draftValue(rubber.code, 2)
		})) as LocalLineupDraft
	);

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

	function hasBodyMessage(error: unknown): error is { body?: { message?: string } } {
		return (
			typeof error === 'object' &&
			error !== null &&
			'body' in error &&
			typeof error.body === 'object' &&
			error.body !== null &&
			(!('message' in error.body) || typeof error.body.message === 'string')
		);
	}

	function hasMessage(error: unknown): error is { message?: string } {
		return (
			typeof error === 'object' &&
			error !== null &&
			(!('message' in error) || typeof error.message === 'string')
		);
	}

	function errorMessage(error: unknown) {
		if (error instanceof Error && error.message) return error.message;
		if (hasBodyMessage(error) && error.body?.message) {
			return error.body.message;
		}
		if (hasMessage(error) && error.message) {
			return error.message;
		}
		return 'エラーが発生しました';
	}

	$effect(() => {
		const items = rubberDefinitions.map((rubber) => ({
			rubberCode: rubber.code,
			player1Id: draftValue(rubber.code, 1),
			player2Id: draftValue(rubber.code, 2)
		}));
		untrack(() => lineup.fields.set({ items }));
	});
</script>

<form {...enhancedForm} class="divide-y divide-zinc-100">
	{#each rubberDefinitions as rubber, index (rubber.code)}
		{@const itemField = lineup.fields.items[index]}
		<div class="px-5 py-4">
			<input {...itemField.rubberCode.as('hidden', rubber.code)} />
			<p class="mb-2.5 text-xs font-medium text-muted-foreground">{rubberLabel(rubber.code)}</p>
			<div class="grid grid-cols-2 gap-2">
				{#each [1, 2] as const as typedOrder (typedOrder)}
					{@const slotPlayers = filteredPlayers(rubber.discipline, typedOrder)}
					{@const playerItems: SelectItem[] = [
						{ value: '', label: '未入力' },
						...slotPlayers.map((p) => ({ value: p.id, label: p.name }))
					]}
					<div>
						<span class="mb-1 block text-xs text-muted">
							{slotLabel(rubber.discipline, typedOrder)}
						</span>
						{#if typedOrder === 1}
							<AppSelect
								{...itemField.player1Id.as('select')}
								items={playerItems}
								placeholder="未入力"
								onValueChange={(value) => {
									const item = draftItems.find((i) => i.rubberCode === rubber.code);
									if (item) {
										item.player1Id = value;
										draftItems = [...draftItems];
										onDraftChange(draftItems);
									}
								}}
							/>
						{:else}
							<AppSelect
								{...itemField.player2Id.as('select')}
								items={playerItems}
								placeholder="未入力"
								onValueChange={(value) => {
									const item = draftItems.find((i) => i.rubberCode === rubber.code);
									if (item) {
										item.player2Id = value;
										draftItems = [...draftItems];
										onDraftChange(draftItems);
									}
								}}
							/>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/each}

	<div class="flex items-end sm:items-center justify-end gap-3 px-5 py-4 flex-col sm:flex-row">
		<span class="text-xs text-muted">入力内容はこの端末に自動保存されます</span>
		<AppButton type="submit" loading={lineup.pending > 0}>提出する</AppButton>
	</div>
</form>
