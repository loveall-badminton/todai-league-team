<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/PageHeader.svelte';
</script>

<svelte:head>
	<title>団体戦カードへ移動 | 東大リーグ団体戦</title>
</svelte:head>

<PageHeader
	title="団体戦カードへ移動します"
	description="Tournament 管理はこのアプリの運営導線では使いません。"
/>
<a
	class="inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
	href={resolve('/ties')}
>
	団体戦カード
</a>
