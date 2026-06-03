<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>LoveAll Live Score</title>
</svelte:head>

<main class="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-950">
	<div class="mx-auto max-w-4xl">
		<h1 class="text-3xl font-semibold">LoveAll Live Score</h1>
		<p class="mt-3 max-w-2xl text-zinc-600">
			大会、コート、試合、審判入力、公開ライブスコアを管理します。
		</p>
		<a
			class="mt-6 inline-flex rounded-md bg-zinc-900 px-5 py-3 font-medium text-white"
			href={resolve('/tournaments')}
		>
			大会一覧へ
		</a>
	</div>
</main>
