<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/PageHeader.svelte';
</script>

<svelte:head>
	<title>種目から試合を作成 | 東大リーグ団体戦</title>
</svelte:head>

<PageHeader
	title="種目から試合を作成"
	description="試合は対戦詳細の種目操作から作成してください。"
/>
<a
	class="inline-flex rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
	href={resolve('/ties')}
>
	対戦一覧
</a>
