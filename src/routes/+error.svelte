<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AppButton from '$lib/components/AppButton.svelte';

	const statusCodeToMessage: Record<number, string> = {
		403: 'アクセス権限がありません',
		404: 'ページが見つかりません'
	};
</script>

<svelte:head>
	<title>エラー | 東大リーグ団体戦</title>
</svelte:head>

<div class="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
	<p class="animate-pulse text-6xl font-bold text-zinc-300">
		{page.status}
	</p>
	<p class="mt-4 text-lg font-semibold text-default">
		{statusCodeToMessage[page.status] || 'エラーが発生しました'}
	</p>
	{#if page.error?.message && page.error.message !== 'Not found'}
		<p class="mt-2 text-sm text-muted-foreground">{page.error.message}</p>
	{/if}
	<AppButton href={resolve('/')} class="mt-8">ホームへ戻る</AppButton>
</div>
