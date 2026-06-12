<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>ライブ表示 | 東大リーグ団体戦</title>
</svelte:head>

<main class="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-950 sm:px-6">
	<div class="mx-auto max-w-2xl">
		<div class="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
			<h1 class="text-xl font-semibold tracking-tight">ライブ表示へ移動します</h1>
			<p class="mt-2 text-sm text-zinc-500">
				公開ライブは大会IDではなく、東大リーグ団体戦全体として表示します。
			</p>
			<a
				class="mt-4 inline-flex rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
				href={resolve('/live')}
			>
				ライブ表示
			</a>
		</div>
	</div>
</main>
