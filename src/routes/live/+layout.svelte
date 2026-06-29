<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { AlarmClock } from '@lucide/svelte';
	import type { LayoutProps } from './$types';
	import { useLineupClock } from '$lib/utils/lineupCountdown.svelte';

	let { data, children }: LayoutProps = $props();

	const livePath = resolve('/live');
	const standingsPath = resolve('/live/standings');
	const tasksPath = resolve('/live/tasks');

	let showTabs = $derived(!page.url.pathname.startsWith(tasksPath));

	function isTabActive(path: string) {
		const pathname = page.url.pathname;
		if (path === livePath) {
			return pathname === livePath || pathname.startsWith(resolve('/live/ties/'));
		}
		return pathname.startsWith(path);
	}

	const { remainingMin } = useLineupClock();

	let bannerDismissed = $state(false);
	let pendingLineups = $derived(data.pendingLineups ?? []);
	let showBanner = $derived(
		!bannerDismissed && pendingLineups.length > 0 && !page.url.pathname.startsWith(tasksPath)
	);

	let urgentTie = $derived(
		[...pendingLineups]
			.filter((t) => t.lineupDueAt)
			.sort((a, b) => new Date(a.lineupDueAt!).getTime() - new Date(b.lineupDueAt!).getTime())[0] ??
			pendingLineups[0]
	);
	let urgentRemainingMin = $derived(remainingMin(urgentTie?.lineupDueAt));
</script>

{#if showBanner}
	<div
		class="mb-2 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
	>
		<div class="flex items-center gap-2">
			<AlarmClock class="size-3.5 shrink-0 text-amber-600" />
			{#if pendingLineups.length === 1}
				<span>
					<span class="font-medium">{urgentTie.tieCode}</span> のオーダーが未提出です
					{#if urgentRemainingMin !== null}
						— <span
							class={urgentRemainingMin <= 0
								? 'text-muted-foreground'
								: urgentRemainingMin <= 5
									? 'font-bold text-red-700'
									: urgentRemainingMin <= 10
										? 'font-semibold text-amber-900'
										: ''}
							>{urgentRemainingMin > 0 ? `あと ${urgentRemainingMin} 分` : '締切済'}</span
						>
					{/if}
				</span>
			{:else}
				<span>
					オーダー未提出 <span class="font-medium">{pendingLineups.length} 件</span>
					{#if urgentRemainingMin !== null}
						— 最短 <span
							class={urgentRemainingMin <= 0
								? 'text-muted-foreground'
								: urgentRemainingMin <= 5
									? 'font-bold text-red-700'
									: urgentRemainingMin <= 10
										? 'font-semibold text-amber-900'
										: ''}
							>{urgentRemainingMin > 0 ? `あと ${urgentRemainingMin} 分` : '締切済'}</span
						>
					{/if}
				</span>
			{/if}
		</div>
		<div class="flex shrink-0 items-center gap-3">
			<a href={tasksPath} class="text-xs font-semibold text-amber-700 hover:underline">提出する →</a
			>
			<button
				type="button"
				onclick={() => (bannerDismissed = true)}
				class="text-amber-400 hover:text-amber-700"
				aria-label="閉じる">✕</button
			>
		</div>
	</div>
{/if}

{#if showTabs}
	<nav class="mb-4 flex w-fit gap-0.5 rounded-lg bg-zinc-100 p-0.5">
		<a
			href={livePath}
			class="rounded-md px-4 py-1.5 text-sm font-medium {isTabActive(livePath)
				? 'bg-white shadow-sm text-zinc-900'
				: 'text-muted hover:text-default hover:bg-zinc-50'}">進行表</a
		>
		<a
			href={standingsPath}
			class="rounded-md px-4 py-1.5 text-sm font-medium {isTabActive(standingsPath)
				? 'bg-white shadow-sm text-zinc-900'
				: 'text-muted hover:text-default hover:bg-zinc-50'}">順位表</a
		>
	</nav>
{/if}

{@render children()}
