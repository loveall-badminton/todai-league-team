<script lang="ts">
	import { resolve } from '$app/paths';
	import { phaseLabel } from '$lib/domain/tokyoLeagueLabels';
	import Card from '$lib/components/Card.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { Settings } from '@lucide/svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const stats = $derived([
		{ label: 'Aリーグ', value: data.groupA.length, unit: '対戦' },
		{ label: 'Bリーグ', value: data.groupB.length, unit: '対戦' },
		{ label: '進行中', value: data.playing.length, unit: '対戦' },
		{ label: 'チーム', value: data.teams.length, unit: 'チーム' }
	]);

	const alerts = $derived([
		{
			label: 'オーダー未提出',
			count: data.lineupPending.length,
			href: resolve('/ties'),
			color: 'bg-amber-100 text-amber-800'
		},
		{
			label: '結果確認待ち',
			count: data.confirmPending.length,
			href: resolve('/ties'),
			color: 'bg-orange-100 text-orange-800'
		},
		{
			label: '審判未割当',
			count: data.officiatingMissing.length,
			href: resolve('/officiating'),
			color: 'bg-red-100 text-red-800'
		},
		{
			label: 'スケジュール変更',
			count: data.scheduleChanged.length,
			href: resolve('/schedule'),
			color: 'bg-blue-100 text-blue-800'
		}
	]);

	const activeAlerts = $derived(alerts.filter((a) => a.count > 0));
</script>

<svelte:head>
	<title>東大リーグ団体戦</title>
</svelte:head>

<div class="px-4 py-6 sm:px-6">
	<div class="mx-auto max-w-6xl space-y-6">
		<!-- Header -->
		<header class="flex items-center justify-between">
			<div>
				<p class="text-xs font-medium tracking-wide text-zinc-500 uppercase">運営ホーム</p>
				<h1 class="text-2xl font-bold text-zinc-950">
					{data.settings?.eventName ?? '東大リーグ団体戦'}
				</h1>
			</div>
			<a
				href={resolve('/settings')}
				class="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
			>
				<Settings class="h-4 w-4 text-zinc-500" />
				設定
			</a>
		</header>

		<!-- Stats row -->
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each stats as stat (stat.label)}
				<Card class="p-4">
					<p class="text-xs font-medium tracking-wide text-zinc-500 uppercase">{stat.label}</p>
					<p class="mt-1 text-4xl font-bold text-zinc-950">{stat.value}</p>
					<p class="text-xs text-zinc-400">{stat.unit}</p>
				</Card>
			{/each}
		</div>

		<!-- Active alerts -->
		{#if activeAlerts.length > 0}
			<Card class="p-4">
				<h2 class="mb-3 text-base font-semibold text-zinc-950">要対応</h2>
				<div class="flex flex-wrap gap-2">
					{#each activeAlerts as alert (alert.label)}
						<a
							href={alert.href}
							class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-80 {alert.color}"
						>
							{alert.label}
							<span class="rounded-full bg-black/10 px-1.5 py-0.5 text-xs leading-none font-bold">
								{alert.count}
							</span>
						</a>
					{/each}
				</div>
			</Card>
		{/if}

		<div class="grid gap-4 lg:grid-cols-2">
			<!-- Playing ties -->
			<Card class="p-4">
				<div class="mb-3 flex items-center justify-between">
					<h2 class="text-base font-semibold text-zinc-950">進行中の対戦</h2>
					<span class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
						{data.playing.length}
					</span>
				</div>
				<div class="space-y-2">
					{#each data.playing as tie (tie.id)}
						<a
							href={resolve('/ties/[tieId]', { tieId: tie.id })}
							class="flex items-center justify-between rounded-xl border border-zinc-200 p-3 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
						>
							<div class="min-w-0">
								<p class="text-sm font-semibold text-zinc-950">{tie.tieCode}</p>
								<p class="truncate text-xs text-zinc-500">
									{tie.teamAName ?? '未定'} vs {tie.teamBName ?? '未定'}
								</p>
							</div>
							<StatusBadge status={tie.status} />
						</a>
					{:else}
						<div class="rounded-xl border border-dashed border-zinc-200 p-6 text-center">
							<p class="text-sm text-zinc-400">進行中の対戦はありません</p>
						</div>
					{/each}
				</div>
			</Card>

			<!-- Alert details -->
			<Card class="p-4">
				<div class="mb-3 flex items-center justify-between">
					<h2 class="text-base font-semibold text-zinc-950">対応一覧</h2>
				</div>
				<div class="space-y-2">
					{#each alerts as alert (alert.label)}
						<a
							href={alert.href}
							class="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 transition-colors hover:bg-zinc-100"
						>
							<span class="text-sm font-medium text-zinc-700">{alert.label}</span>
							<span class="text-sm font-bold {alert.count > 0 ? 'text-zinc-950' : 'text-zinc-300'}">
								{alert.count}
							</span>
						</a>
					{/each}
				</div>
			</Card>
		</div>

		<!-- Recent ties list -->
		<Card>
			<div class="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
				<h2 class="text-base font-semibold text-zinc-950">団体戦カード</h2>
				<a href={resolve('/ties')} class="text-xs font-medium text-zinc-500 hover:text-zinc-950">
					すべて見る →
				</a>
			</div>
			<div class="divide-y divide-zinc-100">
				{#each data.ties.slice(0, 10) as tie (tie.id)}
					<a
						href={resolve('/ties/[tieId]', { tieId: tie.id })}
						class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50"
					>
						<div class="w-16 flex-none">
							<span class="text-sm font-semibold text-zinc-950">{tie.tieCode}</span>
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm text-zinc-700">
								{tie.teamAName ?? '未定'} <span class="text-zinc-400">vs</span>
								{tie.teamBName ?? '未定'}
							</p>
							<p class="text-xs text-zinc-400">{phaseLabel(tie.phase)}</p>
						</div>
						<StatusBadge status={tie.status} />
					</a>
				{:else}
					<div class="px-4 py-8 text-center">
						<p class="text-sm text-zinc-400">対戦はまだありません</p>
					</div>
				{/each}
			</div>
		</Card>
	</div>
</div>
