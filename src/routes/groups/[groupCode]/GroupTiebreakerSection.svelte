<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import Card from '$lib/components/ui/Card.svelte';
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import AppInput from '$lib/components/ui/AppInput.svelte';
	import IconMeta from '$lib/components/ui/IconMeta.svelte';
	import AppSelect from '$lib/components/ui/AppSelect.svelte';
	import FormToast from '$lib/components/ui/FormToast.svelte';
	import type { SelectItem } from '$lib/types/ui';
	import { tiebreakerStatusLabel } from '$lib/domain/tokyoLeagueLabels';
	import { Award } from '@lucide/svelte';
	import { createTiebreaker, syncTiebreaker } from './group.remote';

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
		rankingTiebreakers,
		groupTeamItems,
		groupTeamPlayers,
		teamName
	}: {
		rankingTiebreakers: {
			id: string;
			reason: string;
			status: string;
			winnerTeamId: string | null;
			matchId: string | null;
		}[];
		groupTeamItems: SelectItem[];
		groupTeamPlayers: { teamId: string; players: PlayerForSelection[] }[];
		teamName: (id: string | null) => string;
	} = $props();

	let teamAId = $derived(createTiebreaker.fields.teamAId.value() ?? '');
	let teamBId = $derived(createTiebreaker.fields.teamBId.value() ?? '');
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
		<form {...createTiebreaker} class="grid gap-3 lg:grid-cols-6">
			<div class="grid gap-1 lg:col-span-6">
				<span class="text-xs font-medium text-muted-foreground">種目</span>
				<AppSelect
					{...createTiebreaker.fields.discipline.as('select')}
					items={disciplineItems}
					required
					onValueChange={(value) => {
						discipline = value;
					}}
				/>
			</div>
			<div class="grid gap-1">
				<span class="text-xs font-medium text-muted-foreground">A側チーム</span>
				<AppSelect
					{...createTiebreaker.fields.teamAId.as('select')}
					items={groupTeamItems}
					required
					onValueChange={(value) => {
						teamAId = value;
					}}
				/>
			</div>
			<div class="grid gap-1">
				<span class="text-xs font-medium text-muted-foreground">A側選手1</span>
				<AppSelect
					{...createTiebreaker.fields.playerA1Id.as('select')}
					items={playerA1Items}
					required
					disabled={playerADisabled}
				/>
			</div>
			<div class="grid gap-1">
				<span class="text-xs font-medium text-muted-foreground">A側選手2</span>
				<AppSelect
					{...createTiebreaker.fields.playerA2Id.as('select')}
					items={playerA2Items}
					required
					disabled={playerADisabled}
				/>
			</div>
			<div class="grid gap-1">
				<span class="text-xs font-medium text-muted-foreground">B側チーム</span>
				<AppSelect
					{...createTiebreaker.fields.teamBId.as('select')}
					items={groupTeamItems}
					required
					onValueChange={(value) => {
						teamBId = value;
					}}
				/>
			</div>

			<div class="grid gap-1">
				<span class="text-xs font-medium text-muted-foreground">B側選手1</span>
				<AppSelect
					{...createTiebreaker.fields.playerB1Id.as('select')}
					items={playerB1Items}
					required
					disabled={playerBDisabled}
				/>
			</div>
			<div class="grid gap-1">
				<span class="text-xs font-medium text-muted-foreground">B側選手2</span>
				<AppSelect
					{...createTiebreaker.fields.playerB2Id.as('select')}
					items={playerB2Items}
					required
					disabled={playerBDisabled}
				/>
			</div>
			<div class="grid gap-1 lg:col-span-6">
				<span class="text-xs font-medium text-muted-foreground">理由</span>
				<AppInput
					{...createTiebreaker.fields.reason.as('text')}
					placeholder="順位未確定のため"
					required
				/>
			</div>
			<div class="lg:col-span-6">
				<AppButton type="submit">再試合作成</AppButton>
			</div>
		</form>
		<FormToast result={createTiebreaker.result} />

		{#if rankingTiebreakers.length > 0}
			<div class="space-y-2 border-t border-border-subtle pt-2">
				{#each rankingTiebreakers as item (item.id)}
					<div
						class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle px-4 py-3 text-sm"
					>
						<div class="space-y-0.5">
							<p class="font-medium">{item.reason}</p>
							<p class="text-xs text-muted-foreground">
								{tiebreakerStatusLabel(item.status)}
								{#if item.winnerTeamId}
									<span class="mx-1">/</span>
									<IconMeta
										Icon={Award}
										label="勝者"
										value={teamName(item.winnerTeamId)}
										class="text-xs text-muted-foreground"
										iconClass="size-3 shrink-0"
									/>
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
									onclick={async () => {
										await syncTiebreaker({ matchId: item.matchId! });
										await invalidateAll();
									}}
								>
									同期
								</AppButton>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-sm text-muted-foreground">作成済みの順位決定再試合はありません。</p>
		{/if}
	</div>
</Card>
