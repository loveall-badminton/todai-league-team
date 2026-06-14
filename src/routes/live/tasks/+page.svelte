<script lang="ts">
	import { resolve } from '$app/paths';
	import { ClipboardList, Shield } from '@lucide/svelte';
	import Badge from '$lib/components/Badge.svelte';
	import AppButton from '$lib/components/AppButton.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { rubberLabel, rubberStatusLabel, tieStatusLabel } from '$lib/domain/tokyoLeagueLabels';
	import { statusBadgeColor } from '$lib/utils/statusStyles';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let myTeamId = $derived(data.authProfile?.teamId ?? null);
	let isTeamAccount = $derived(data.authProfile?.accountType === 'team' && !!myTeamId);
</script>

<svelte:head>
	<title>オーダー/審判 | 東大リーグ団体戦</title>
</svelte:head>

<PageHeader
	title="オーダー/審判"
	description="このページをこまめに確認して、オーダー提出や審判担当の対戦を見逃さないようにしてください。"
/>

{#if isTeamAccount}
	<div class="grid gap-4 sm:grid-cols-2">
		<div class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
			<div class="mb-3 flex items-center gap-2">
				<ClipboardList class="h-4 w-4 text-zinc-500" />
				<h2 class="text-sm font-semibold text-zinc-950">オーダー提出</h2>
			</div>
			{#if data.myTies.some((t) => t.status === 'lineup_pending')}
				<p class="mb-3 text-xs text-zinc-400">
					オーダーは時間に余裕をもって提出してください。
					スムーズな大会運営へのご協力をお願いします。
				</p>
			{/if}
			{#if data.myTies.length === 0}
				<p class="text-sm text-zinc-400">提出すべきオーダーはありません</p>
			{:else}
				<div class="space-y-2">
					{#each data.myTies as tie (tie.id)}
						<a
							href={resolve('/ties/[tieId]/lineups/[teamId]', {
								tieId: tie.id,
								teamId: myTeamId!
							})}
							class="flex items-center justify-between rounded-xl border border-zinc-100 px-3 py-2.5 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
						>
							<div class="min-w-0">
								<p class="text-sm font-medium text-zinc-950">{tie.tieCode}</p>
								<p class="truncate text-xs text-zinc-500">
									{tie.teamAName ?? '未定'} vs {tie.teamBName ?? '未定'}
								</p>
							</div>
							<Badge color={statusBadgeColor(tie.status)}>
								{tieStatusLabel(tie.status)}
							</Badge>
						</a>
					{/each}
				</div>
			{/if}
		</div>

		<div class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
			<div class="mb-3 flex items-center gap-2">
				<Shield class="h-4 w-4 text-zinc-500" />
				<h2 class="text-sm font-semibold text-zinc-950">審判担当</h2>
			</div>
			{#if data.myOfficiatingTies.length === 0}
				<p class="text-sm text-zinc-400">審判担当の対戦はありません</p>
			{:else}
				<div class="space-y-3">
					{#each data.myOfficiatingTies as tie (tie.id)}
						{@const rubbers = data.publicRubbersByTieId[tie.id] ?? []}
						{@const playableRubbers = rubbers.filter((r) => r.matchId)}
						<div>
							<p class="mb-1 text-xs font-medium text-zinc-500">
								{tie.tieCode} — {tie.teamAName ?? '未定'} vs {tie.teamBName ?? '未定'}
							</p>
							{#if playableRubbers.length === 0}
								<p class="text-xs text-zinc-400">試合の準備ができるまでお待ちください</p>
							{:else}
								<div class="space-y-1">
									{#each playableRubbers as rubber (rubber.id)}
										<AppButton
											href={resolve('/referee/[matchId]', { matchId: rubber.matchId! })}
											variant="secondary"
											size="sm"
											class="w-full justify-between"
										>
											<span>{rubberLabel(rubber.code)}</span>
											<span class="text-zinc-400">{rubberStatusLabel(rubber.status)} →</span>
										</AppButton>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{:else}
	<div class="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
		<p class="text-sm text-zinc-500">
			チームアカウントでログインすると、オーダー提出と審判担当が表示されます。
		</p>
	</div>
{/if}
