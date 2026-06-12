<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import {
		Home,
		Users,
		LayoutGrid,
		Trophy,
		List,
		Radio,
		Settings,
		Menu,
		X
	} from '@lucide/svelte';

	let { children } = $props();
	let drawerOpen = $state(false);

	type NavItem = {
		label: string;
		href: string;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		icon: any;
	};

	const navItems: NavItem[] = [
		{ label: 'ホーム', href: resolve('/'), icon: Home },
		{ label: 'チーム', href: resolve('/teams'), icon: Users },
		{ label: '予選', href: resolve('/groups'), icon: LayoutGrid },
		{ label: '決勝', href: resolve('/finals'), icon: Trophy },
		{ label: '対戦管理', href: resolve('/ties'), icon: List },
		{ label: 'ライブ', href: resolve('/live'), icon: Radio },
		{ label: '設定', href: resolve('/settings'), icon: Settings }
	];

	function isActive(href: string) {
		const pathname = page.url.pathname;
		if (href === resolve('/')) return pathname === href;
		return pathname.startsWith(href);
	}

	function closeDrawer() {
		drawerOpen = false;
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- Mobile header -->
<header
	class="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 lg:hidden"
>
	<span class="text-base font-bold text-zinc-950">東大リーグ</span>
	<button
		type="button"
		class="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100"
		onclick={() => (drawerOpen = true)}
		aria-label="メニューを開く"
	>
		<Menu class="h-5 w-5" />
	</button>
</header>

<!-- Mobile drawer backdrop -->
{#if drawerOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40 bg-black/30 lg:hidden" onclick={closeDrawer}></div>
{/if}

<!-- Mobile slide-out drawer -->
<div
	class="fixed inset-y-0 left-0 z-50 w-64 transform bg-white shadow-xl transition-transform duration-200 ease-in-out lg:hidden {drawerOpen
		? 'translate-x-0'
		: '-translate-x-full'}"
>
	<div class="flex items-center justify-between border-b border-zinc-200 px-4 py-4">
		<span class="text-base font-bold text-zinc-950">東大リーグ団体戦</span>
		<button
			type="button"
			class="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
			onclick={closeDrawer}
			aria-label="メニューを閉じる"
		>
			<X class="h-4 w-4" />
		</button>
	</div>
	<nav class="flex flex-col gap-0.5 p-3">
		{#each navItems as item (item.href)}
			{@const Icon = item.icon}
			<a
				href={item.href}
				onclick={closeDrawer}
				class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors {isActive(item.href) ? 'bg-zinc-950 text-white' : 'text-zinc-700 hover:bg-zinc-100'}"
			>
				<Icon class="h-4 w-4 shrink-0" />
				{item.label}
			</a>
		{/each}
	</nav>
</div>

<!-- Desktop layout -->
<div class="flex min-h-screen bg-zinc-50 lg:min-h-screen">
	<!-- Desktop sidebar -->
	<aside class="fixed inset-y-0 left-0 hidden w-52 flex-col border-r border-zinc-200 bg-white lg:flex">
		<div class="border-b border-zinc-200 px-4 py-5">
			<span class="block text-sm font-bold leading-tight text-zinc-950">東大リーグ<br />団体戦</span>
		</div>
		<nav class="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
			{#each navItems as item (item.href)}
				{@const Icon = item.icon}
				<a
					href={item.href}
					class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors {isActive(item.href) ? 'bg-zinc-950 text-white' : 'text-zinc-700 hover:bg-zinc-100'}"
				>
					<Icon class="h-4 w-4 shrink-0" />
					{item.label}
				</a>
			{/each}
		</nav>
	</aside>

	<!-- Main content -->
	<main class="flex-1 lg:ml-52">
		{@render children()}
	</main>
</div>
