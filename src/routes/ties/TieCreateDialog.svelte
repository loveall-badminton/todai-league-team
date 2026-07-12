<script lang="ts">
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import AppInput from '$lib/components/ui/AppInput.svelte';
	import AppSelect from '$lib/components/ui/AppSelect.svelte';
	import CourtPicker from '$lib/components/CourtPicker.svelte';
	import DialogCloseButton from '$lib/components/ui/DialogCloseButton.svelte';
	import { Dialog } from 'bits-ui';
	import type { EntityOption } from '$lib/types/entities';
	import { create } from './ties.remote';

	type DialogData = {
		scoringRules: { id: string; name?: string; code: string }[];
		teams: EntityOption[];
	};

	let { open = $bindable(false), data }: { open: boolean; data: DialogData } = $props();

	const groupCodeItems = [
		{ value: '', label: '決勝トーナメント' },
		{ value: 'A', label: 'Aリーグ' },
		{ value: 'B', label: 'Bリーグ' }
	];
	const phaseItems = [
		{ value: 'semifinal', label: '準決勝' },
		{ value: 'fifth_place', label: '5位決定戦' },
		{ value: 'third_place', label: '3位決定戦' },
		{ value: 'final', label: '決勝' },
		{ value: 'ranking_tiebreaker', label: '順位決定再試合' }
	];
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl outline-none"
		>
			<div class="mb-5 flex items-center justify-between">
				<Dialog.Title class="text-base font-semibold text-default">対戦を作成</Dialog.Title>
				<DialogCloseButton />
			</div>

			<form {...create} class="space-y-4">
				<div class="grid gap-3 sm:grid-cols-2">
					<div class="space-y-1">
						<span class="text-xs font-medium text-muted-emphasis"
							>コード <span class="text-red-500">*</span></span
						>
						<AppInput {...create.fields.tieCode.as('text', '')} placeholder="A-1" required />
					</div>
					<div class="space-y-1">
						<span class="text-xs font-medium text-muted-emphasis"
							>得点ルール <span class="text-red-500">*</span></span
						>
						<AppSelect
							{...create.fields.scoringRuleId.as('select', data.scoringRules[0]?.id ?? '')}
							required
							items={data.scoringRules.map((r: { id: string; name?: string; code: string }) => ({
								value: r.id,
								label: r.name ?? r.code
							}))}
						/>
					</div>
				</div>

				<div class="grid gap-3 sm:grid-cols-3">
					<div class="space-y-1">
						<span class="text-xs font-medium text-muted-emphasis">リーグ</span>
						<AppSelect
							{...create.fields.groupCode.as('select', '')}
							items={groupCodeItems}
							placeholder="決勝トーナメント"
						/>
					</div>
					<div class="space-y-1">
						<span class="text-xs font-medium text-muted-emphasis">フェーズ</span>
						<AppSelect {...create.fields.phase.as('select', 'semifinal')} items={phaseItems} />
					</div>
					<div class="space-y-1">
						<span class="text-xs font-medium text-muted-emphasis">予定時刻</span>
						<AppInput {...create.fields.scheduledStartAt.as('time', '')} />
					</div>
				</div>

				<div class="grid gap-3 sm:grid-cols-2">
					<div class="space-y-1">
						<span class="text-xs font-medium text-muted-emphasis">A側チーム</span>
						<AppSelect
							{...create.fields.teamAId.as('select', '')}
							items={[
								{ value: '', label: '未定' },
								...data.teams.map((t: EntityOption) => ({
									value: t.id,
									label: t.name
								}))
							]}
							placeholder="未定"
						/>
					</div>
					<div class="space-y-1">
						<span class="text-xs font-medium text-muted-emphasis">B側チーム</span>
						<AppSelect
							{...create.fields.teamBId.as('select', '')}
							items={[
								{ value: '', label: '未定' },
								...data.teams.map((t: EntityOption) => ({
									value: t.id,
									label: t.name
								}))
							]}
							placeholder="未定"
						/>
					</div>
				</div>

				<div class="space-y-1">
					<span class="text-xs font-medium text-muted-emphasis">体育館・コート</span>
					<CourtPicker />
				</div>

				<div class="flex justify-end gap-2 pt-1">
					<Dialog.Close
						class="rounded-xl border border-border px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
					>
						キャンセル
					</Dialog.Close>
					<AppButton type="submit">作成</AppButton>
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
