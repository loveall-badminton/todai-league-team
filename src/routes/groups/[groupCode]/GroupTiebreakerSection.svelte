<script lang="ts">
	import { resolve } from '$app/paths';
	import Card from '$lib/components/Card.svelte';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import FormToast from '$lib/components/FormToast.svelte';
	import type { SelectItem } from '$lib/types/ui';
	import type { FormInstance } from '$lib/types/forms';
	import { createTiebreakerSchema } from './group.schema';
	import { tiebreakerStatusLabel } from '$lib/domain/tokyoLeagueLabels';

	type TiebreakerDiscipline = 'MD' | 'XD' | 'WD';
	type PlayerForSelection = {
		id: string;
		name: string;
		gender: 'male' | 'female' | 'unknown';
	};

	function filteredPlayers(
		discipline: TiebreakerDiscipline,
		order: 1 | 2,
		players: PlayerForSelection[]
	) {
		return players.filter((player) => {
			if (player.gender === 'unknown') return true;
			if (discipline === 'WD') return player.gender === 'female';
			if (discipline === 'MD') return player.gender === 'male';
			return order === 1 ? player.gender === 'female' : player.gender === 'male';
		});
	}

	function playerItems(players: PlayerForSelection[]): SelectItem[] {
		return [
			{ value: '', label: '選択' },
			...players.map((player) => ({
				value: player.id,
				label: player.name
			}))
		];
	}

	let {
		createTiebreakerForm,
		rankingTiebreakers,
		groupTeamItems,
		groupTeamPlayers,
		onSyncTiebreaker,
		teamName
	}: {
		createTiebreakerForm: FormInstance<typeof createTiebreakerSchema>;
		rankingTiebreakers: {
			id: string;
			reason: string;
			status: string;
			winnerTeamId: string | null;
			matchId: string | null;
		}[];
		groupTeamItems: SelectItem[];
		groupTeamPlayers: { teamId: string; players: PlayerForSelection[] }[];
		onSyncTiebreaker: (matchId: string) => Promise<unknown>;
		teamName: (id: string | null) => string;
	} = $props();

	let teamAId = $derived(createTiebreakerForm.fields.teamAId.value() ?? '');
	let teamBId = $derived(createTiebreakerForm.fields.teamBId.value() ?? '');
	const disciplineItems: SelectItem[] = [
		{ value: 'MD', label: '男子ダブルス' },
		{ value: 'XD', label: 'ミックスダブルス' },
		{ value: 'WD', label: '女子ダブルス' }
	];

	let discipline = $state('');
	let selectedDiscipline = $derived(discipline as TiebreakerDiscipline);
	let teamAPlayers = $derived(
		teamAId ? (groupTeamPlayers.find((team) => team.teamId === teamAId)?.players ?? []) : []
	);
	let playerA1Items = $derived<SelectItem[]>(
		discipline === ''
			? [{ value: '', label: '選択' }]
			: playerItems(filteredPlayers(selectedDiscipline, 1, teamAPlayers))
	);
	let playerA2Items = $derived<SelectItem[]>(
		discipline === ''
			? [{ value: '', label: '選択' }]
			: playerItems(filteredPlayers(selectedDiscipline, 2, teamAPlayers))
	);
	let playerADisabled = $derived(discipline === '' || teamAId === '');

	let teamBPlayers = $derived(
		teamBId ? (groupTeamPlayers.find((team) => team.teamId === teamBId)?.players ?? []) : []
	);
	let playerB1Items = $derived<SelectItem[]>(
		discipline === ''
			? [{ value: '', label: '選択' }]
			: playerItems(filteredPlayers(selectedDiscipline, 1, teamBPlayers))
	);
	let playerB2Items = $derived<SelectItem[]>(
		discipline === ''
			? [{ value: '', label: '選択' }]
			: playerItems(filteredPlayers(selectedDiscipline, 2, teamBPlayers))
	);
	let playerBDisabled = $derived(discipline === '' || teamBId === '');
</script>

<Card>
	{#snippet header()}
		<h2 class="font-semibold">順位決定再試合</h2>
	{/snippet}
	<div class="space-y-5">
		<form {...createTiebreakerForm} class="grid gap-3 lg:grid-cols-6">
			<div class="grid gap-1 lg:col-span-6">
				<span class="text-xs font-medium text-zinc-500">種目</span>
				<AppSelect
					{...createTiebreakerForm.fields.discipline.as('select')}
					items={disciplineItems}
					required
					onValueChange={(value) => {
						discipline = value;
					}}
				/>
			</div>
			<div class="grid gap-1">
				<span class="text-xs font-medium text-zinc-500">A側チーム</span>
				<AppSelect
					{...createTiebreakerForm.fields.teamAId.as('select')}
					items={groupTeamItems}
					required
					onValueChange={(value) => {
						teamAId = value;
					}}
				/>
			</div>
			<div class="grid gap-1">
				<span class="text-xs font-medium text-zinc-500">A側選手1</span>
				<AppSelect
					{...createTiebreakerForm.fields.playerA1Id.as('select')}
					items={playerA1Items}
					required
					disabled={playerADisabled}
				/>
			</div>
			<div class="grid gap-1">
				<span class="text-xs font-medium text-zinc-500">A側選手2</span>
				<AppSelect
					{...createTiebreakerForm.fields.playerA2Id.as('select')}
					items={playerA2Items}
					required
					disabled={playerADisabled}
				/>
			</div>
			<div class="grid gap-1">
				<span class="text-xs font-medium text-zinc-500">B側チーム</span>
				<AppSelect
					{...createTiebreakerForm.fields.teamBId.as('select')}
					items={groupTeamItems}
					required
					onValueChange={(value) => {
						teamBId = value;
					}}
				/>
			</div>

			<div class="grid gap-1">
				<span class="text-xs font-medium text-zinc-500">B側選手1</span>
				<AppSelect
					{...createTiebreakerForm.fields.playerB1Id.as('select')}
					items={playerB1Items}
					required
					disabled={playerBDisabled}
				/>
			</div>
			<div class="grid gap-1">
				<span class="text-xs font-medium text-zinc-500">B側選手2</span>
				<AppSelect
					{...createTiebreakerForm.fields.playerB2Id.as('select')}
					items={playerB2Items}
					required
					disabled={playerBDisabled}
				/>
			</div>
			<div class="grid gap-1 lg:col-span-6">
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
