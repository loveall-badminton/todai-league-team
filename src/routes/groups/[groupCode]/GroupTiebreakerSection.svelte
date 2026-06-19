<script lang="ts">
	import { resolve } from '$app/paths';
	import Card from '$lib/components/Card.svelte';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import FormToast from '$lib/components/FormToast.svelte';
	import type { SelectItem } from '$lib/types/ui';
	import type { FormField, FormActionResult } from '$lib/types/forms';
	import { tiebreakerStatusLabel } from '$lib/domain/tokyoLeagueLabels';

	/* eslint-disable svelte/no-unused-props -- method/action used via {...form} spread */
	let {
		createTiebreakerForm,
		rankingTiebreakers,
		groupTeamItems,
		allPlayerItems,
		onSyncTiebreaker,
		teamName
	}: {
		createTiebreakerForm: {
			method: 'POST';
			action: string;
			fields: {
				teamAId: FormField<string | undefined>;
				teamBId: FormField<string | undefined>;
				playerAId: FormField<string | undefined>;
				playerBId: FormField<string | undefined>;
				reason: FormField<string | undefined>;
			};
			result: FormActionResult | undefined;
		};
		rankingTiebreakers: {
			id: string;
			reason: string;
			status: string;
			winnerTeamId: string | null;
			matchId: string | null;
		}[];
		groupTeamItems: SelectItem[];
		allPlayerItems: SelectItem[];
		onSyncTiebreaker: (matchId: string) => Promise<unknown>;
		teamName: (id: string | null) => string;
	} = $props();
	/* eslint-enable svelte/no-unused-props */
</script>

<Card>
	<div class="border-b border-zinc-100 px-5 py-4">
		<h2 class="font-semibold">順位決定再試合</h2>
	</div>
	<div class="space-y-5 p-5">
		<form {...createTiebreakerForm} class="grid gap-3 lg:grid-cols-6">
			<div class="grid gap-1">
				<span class="text-xs font-medium text-zinc-500">A側チーム</span>
				<AppSelect
					{...createTiebreakerForm.fields.teamAId.as('select')}
					items={groupTeamItems}
					required
				/>
			</div>
			<div class="grid gap-1">
				<span class="text-xs font-medium text-zinc-500">A側選手</span>
				<AppSelect
					{...createTiebreakerForm.fields.playerAId.as('select')}
					items={allPlayerItems}
					required
				/>
			</div>
			<div class="grid gap-1">
				<span class="text-xs font-medium text-zinc-500">B側チーム</span>
				<AppSelect
					{...createTiebreakerForm.fields.teamBId.as('select')}
					items={groupTeamItems}
					required
				/>
			</div>
			<div class="grid gap-1">
				<span class="text-xs font-medium text-zinc-500">B側選手</span>
				<AppSelect
					{...createTiebreakerForm.fields.playerBId.as('select')}
					items={allPlayerItems}
					required
				/>
			</div>
			<div class="grid gap-1 lg:col-span-2">
				<span class="text-xs font-medium text-zinc-500">理由</span>
				<AppInput
					{...createTiebreakerForm.fields.reason.as('text')}
					placeholder="順位未確定のため"
					required
				/>
			</div>
			<div class="lg:col-span-6">
				<AppButton type="submit">再試合作成</AppButton>
			</div>
		</form>
		<FormToast result={createTiebreakerForm.result} />

		{#if rankingTiebreakers.length > 0}
			<div class="space-y-2 border-t border-zinc-100 pt-2">
				{#each rankingTiebreakers as item (item.id)}
					<div
						class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-100 px-4 py-3 text-sm"
					>
						<div class="space-y-0.5">
							<p class="font-medium">{item.reason}</p>
							<p class="text-xs text-zinc-500">
								{tiebreakerStatusLabel(item.status)}
								{#if item.winnerTeamId}
									/ 勝者: {teamName(item.winnerTeamId)}
								{/if}
							</p>
						</div>
						{#if item.matchId}
							<div class="flex items-center gap-2">
								<AppButton
									variant="secondary"
									size="sm"
									href={resolve('/referee/[matchId]', { matchId: item.matchId })}
								>
									審判
								</AppButton>
								<AppButton
									variant="secondary"
									size="sm"
									onclick={() => onSyncTiebreaker(item.matchId!)}
								>
									同期
								</AppButton>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-sm text-zinc-500">作成済みの順位決定再試合はありません。</p>
		{/if}
	</div>
</Card>
