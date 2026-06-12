<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>エラー | 東大リーグ団体戦</title>
</svelte:head>

<div class="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
	<p class="text-6xl font-bold text-zinc-200">{page.status}</p>
	<p class="mt-4 text-lg font-semibold text-zinc-900">
		{page.status === 403
			? 'アクセス権限がありません'
			: page.status === 404
				? 'ページが見つかりません'
				: 'エラーが発生しました'}
	</p>
	{#if page.error?.message && page.error.message !== 'Not found'}
		<p class="mt-2 text-sm text-zinc-500">{page.error.message}</p>
	{/if}
	<a
		href={resolve('/')}
		class="mt-8 rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
	>
		ホームへ戻る
	</a>
</div>
