<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>種目から試合を作成 | 東大リーグ団体戦</title>
</svelte:head>

<div class="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-950 sm:px-6">
	<div class="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
		<h1 class="text-2xl font-semibold">種目から試合を作成します</h1>
		<p class="mt-2 text-sm text-zinc-600">試合は対戦詳細の種目操作から作成してください。</p>
		<a
			class="mt-4 inline-flex rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
			href={resolve('/ties')}
		>
			対戦一覧
		</a>
	</div>
</div>
