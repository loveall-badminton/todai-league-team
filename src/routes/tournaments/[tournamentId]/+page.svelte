<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>団体戦カードへ移動 | 東大リーグ団体戦</title>
</svelte:head>

<main class="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-950 sm:px-6">
	<div class="mx-auto max-w-3xl rounded-md border border-zinc-200 bg-white p-6 shadow-sm">
		<h1 class="text-2xl font-semibold">団体戦カードへ移動します</h1>
		<p class="mt-2 text-sm text-zinc-600">
			汎用 Tournament 詳細は使わず、tie と rubber を中心に管理します。
		</p>
		<a
			class="mt-4 inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
			href={resolve('/ties')}
		>
			団体戦カード
		</a>
	</div>
</main>
