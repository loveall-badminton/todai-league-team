<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/PageHeader.svelte';
</script>

<svelte:head>
	<title>団体戦カードへ移動 | 東大リーグ団体戦</title>
</svelte:head>

<PageHeader
	title="団体戦カードへ移動します"
	description="汎用 Tournament 詳細は使わず、tie と rubber を中心に管理します。"
/>
<a
	class="inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
	href={resolve('/ties')}
>
	団体戦カード
</a>
