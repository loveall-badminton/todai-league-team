<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import type { FormInstance } from '$lib/types/forms';
	import { submitLineupSchema } from './lineup.schema';
	import type { SelectItem } from '$lib/types/ui';
	import type { RubberCode } from '$lib/domain/tokyoLeague';

	type RubberDef = { code: RubberCode; discipline: string };

	let {
		rawForm,
		enhancedForm,
		rubberDefinitions,
		draftValue,
		filteredPlayers,
		slotLabel,
		rubberLabel,
		onSaveDraft
	}: {
		rawForm: FormInstance<typeof submitLineupSchema>;
		enhancedForm: Pick<FormInstance<typeof submitLineupSchema>, 'method' | 'action'>;
		rubberDefinitions: readonly RubberDef[];
		draftValue: (code: RubberCode, order: 1 | 2) => string;
		filteredPlayers: (discipline: string, order: 1 | 2) => { id: string; name: string }[];
		slotLabel: (discipline: string, order: 1 | 2) => string;
		rubberLabel: (code: RubberCode) => string;
		onSaveDraft: (e: MouseEvent) => void;
	} = $props();

	$effect(() => {
		const items = rubberDefinitions.map((rubber) => ({
			rubberCode: rubber.code,
			player1Id: draftValue(rubber.code, 1),
			player2Id: draftValue(rubber.code, 2)
		}));
		rawForm.fields.set({ items });
	});
</script>

<form {...enhancedForm} class="divide-y divide-zinc-100">
	{#each rubberDefinitions as rubber, index (rubber.code)}
		{@const itemField = rawForm.fields.items[index]}
		<div class="px-5 py-4">
			<input {...itemField.rubberCode.as('hidden', rubber.code)} />
			<p class="mb-2.5 text-xs font-medium text-zinc-500">{rubberLabel(rubber.code)}</p>
			<div class="grid grid-cols-2 gap-2">
				{#each [1, 2] as order (order)}
					{@const typedOrder = order as 1 | 2}
					{@const slotPlayers = filteredPlayers(rubber.discipline, typedOrder)}
					{@const playerItems: SelectItem[] = [
						{ value: '', label: '未入力' },
						...slotPlayers.map((p) => ({ value: p.id, label: p.name }))
					]}
					<div>
						<span class="mb-1 block text-xs text-zinc-400">
							{slotLabel(rubber.discipline, typedOrder)}
						</span>
						{#if typedOrder === 1}
							<AppSelect
								{...itemField.player1Id.as('select')}
								items={playerItems}
								placeholder="未入力"
							/>
						{:else}
							<AppSelect
								{...itemField.player2Id.as('select')}
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
			disabled={rawForm.pending > 0}
			onclick={onSaveDraft}
			variant="secondary"
		>
			下書き保存
		</AppButton>
		<AppButton type="submit" disabled={rawForm.pending > 0}>
			{rawForm.pending > 0 ? '送信中…' : '提出する'}
		</AppButton>
	</div>
</form>
