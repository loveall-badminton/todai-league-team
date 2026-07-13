<script lang="ts">
	import { page } from '$app/state';
	import { ChevronDown } from '@lucide/svelte';
	import DocSidebar from './DocSidebar.svelte';
	import type { LayoutProps } from './$types';
	import { cn } from '$lib/utils/cn';

	let { data, children }: LayoutProps = $props();

	let mobileNavOpen = $state(false);

	// headings come from the current page's load data
	let headings = $derived(
		(page.data.doc?.headings ?? []) as { level: number; id: string; text: string }[]
	);
	let h2Headings = $derived(headings.filter((h) => h.level === 2));
</script>

<div class="flex min-w-0 items-start gap-0 lg:gap-8">
	<!-- Desktop docs nav (left, sticky) -->
	<aside class="sticky top-6 hidden w-48 shrink-0 self-start lg:block">
		<p class="mb-3 px-3 text-xs font-semibold tracking-tight text-muted-foreground uppercase">
			使い方ガイド
		</p>
		<DocSidebar sections={data.sections} />
	</aside>

	<!-- Content column (article + mobile nav) -->
	<div class="min-w-0 flex-1">
		<!-- Mobile docs nav (inline collapsible) -->
		<div class="mb-6 rounded-element border border-border bg-white lg:hidden">
			<button
				type="button"
				class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-default"
				onclick={() => (mobileNavOpen = !mobileNavOpen)}
			>
				<span>ページ一覧</span>
				<ChevronDown
					class={cn(
						'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
						mobileNavOpen && 'rotate-180'
					)}
				/>
			</button>
			{#if mobileNavOpen}
				<div class="border-t border-border p-3">
					<DocSidebar sections={data.sections} onNavigate={() => (mobileNavOpen = false)} />
				</div>
			{/if}
		</div>

		{@render children()}
	</div>

	<!-- Desktop "On this page" (right, sticky) -->
	{#if h2Headings.length > 1}
		<aside class="sticky top-6 hidden w-44 shrink-0 self-start lg:block">
			<p class="mb-3 px-1 text-xs font-semibold tracking-tight text-muted-foreground uppercase">
				このページの内容
			</p>
			<nav class="flex flex-col gap-0.5">
				{#each h2Headings as h (h.id)}
					<a
						href="#{h.id}"
						class="block rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:text-zinc-900"
					>
						{h.text}
					</a>
				{/each}
			</nav>
		</aside>
	{/if}
</div>
