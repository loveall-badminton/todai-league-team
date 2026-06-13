<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { Component } from 'svelte';
	import type { LayoutProps } from './$types';
	import {
		House,
		Users,
		LayoutGrid,
		Trophy,
		List,
		Radio,
		Settings,
		Menu,
		X,
		ClipboardList
	} from '@lucide/svelte';
	import type { AppRole } from '$lib/server/auth/access';

	let { data, children }: LayoutProps = $props();
	let drawerOpen = $state(false);

	type NavItem = {
		label: string;
		path: '/' | '/teams' | '/groups' | '/finals' | '/ties' | '/live' | '/live/tasks' | '/settings';
		icon: Component;
		roles: AppRole[];
	};

	const navItems: NavItem[] = [
		{ label: 'ホーム', path: '/', icon: House, roles: ['admin'] },
		{ label: 'チーム', path: '/teams', icon: Users, roles: ['admin'] },
		{ label: '予選', path: '/groups', icon: LayoutGrid, roles: ['admin'] },
		{ label: '決勝', path: '/finals', icon: Trophy, roles: ['admin'] },
		{ label: '対戦管理', path: '/ties', icon: List, roles: ['admin'] },
		{ label: 'ライブ', path: '/live', icon: Radio, roles: ['admin', 'participant', 'team'] },
		{ label: 'オーダー/審判', path: '/live/tasks', icon: ClipboardList, roles: ['team'] },
		{ label: '設定', path: '/settings', icon: Settings, roles: ['admin'] }
	];

	let currentRole = $derived(
		(data.authProfile?.accountType ?? data.user?.role ?? 'participant') as AppRole
	);
	let visibleNavItems = $derived(navItems.filter((item) => item.roles.includes(currentRole)));
	let authPage = $derived(page.url.pathname.startsWith('/auth'));

	function isActive(path: NavItem['path']) {
		const pathname = page.url.pathname;
		const href = resolve(path);
		if (href === resolve('/')) return pathname === href;
		if (href === resolve('/live')) return pathname === href;
		return pathname.startsWith(href);
	}

	function closeDrawer() {
		drawerOpen = false;
	}

	const today = new Date();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if authPage}
	{@render children()}
{:else}
	<!-- Mobile header -->
	<header
		class="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 lg:hidden"
	>
		<span class="text-base font-bold text-zinc-950">東大リーグ団体戦</span>
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
			<span class="text-base font-bold text-zinc-950">メニュー</span>
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
			{#each visibleNavItems as item (item.path)}
				{@const Icon = item.icon}
				<a
					href={resolve(item.path)}
					onclick={closeDrawer}
					class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors {isActive(
						item.path
					)
						? 'bg-zinc-950 text-white'
						: 'text-zinc-700 hover:bg-zinc-100'}"
				>
					<Icon class="h-4 w-4 shrink-0" />
					{item.label}
				</a>
			{/each}
		</nav>
		<form method="POST" action="/auth/login?/signOut" class="border-t border-zinc-200 p-3">
			<button
				class="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-600 hover:bg-zinc-100"
			>
				ログアウト
			</button>
		</form>
	</div>

	<!-- Desktop layout -->
	<div class="flex min-h-screen min-w-0 bg-zinc-50 lg:min-h-screen">
		<!-- Desktop sidebar -->
		<aside
			class="fixed inset-y-0 left-0 hidden w-52 flex-col border-r border-zinc-200 bg-white lg:flex"
		>
			<div class="border-b border-zinc-200 px-4 py-5">
				<span class="block text-sm leading-tight font-bold text-zinc-950">メニュー</span>
			</div>
			<nav class="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
				{#each visibleNavItems as item (item.path)}
					{@const Icon = item.icon}
					<a
						href={resolve(item.path)}
						class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors {isActive(
							item.path
						)
							? 'bg-zinc-950 text-white'
							: 'text-zinc-700 hover:bg-zinc-100'}"
					>
						<Icon class="h-4 w-4 shrink-0" />
						{item.label}
					</a>
				{/each}
			</nav>
			<form method="POST" action="/auth/login?/signOut" class="border-t border-zinc-200 p-3">
				<button
					class="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-600 hover:bg-zinc-100"
				>
					ログアウト
				</button>
			</form>
		</aside>

		<!-- Main content -->
		<div class="flex min-w-0 flex-1 flex-col text-zinc-950 lg:ml-52">
			<main class="min-w-0 flex-1 px-4 py-6 sm:px-6">
				<div class="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6">
					{@render children()}
				</div>
			</main>
			<footer class="flex-0">
				<div class="border-t border-zinc-200 bg-white">
					<div class="px-4 py-5 text-center text-xs font-medium text-zinc-500">
						&copy; {today.getFullYear()} 東京大学ラブオール
					</div>
				</div>
			</footer>
		</div>
	</div>
{/if}
