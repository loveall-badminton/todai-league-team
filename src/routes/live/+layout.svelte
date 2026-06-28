<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	let { children } = $props();

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
</script>

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
