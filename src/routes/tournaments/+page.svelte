<script lang="ts">
	import { resolve } from '$app/paths';
	import AppButton from '$lib/components/AppButton.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
</script>

<svelte:head>
	<title>団体戦カードへ移動 | 東大リーグ団体戦</title>
</svelte:head>

<PageHeader
	title="団体戦カードへ移動します"
	description="Tournament 管理はこのアプリの運営導線では使いません。"
/>
<AppButton href={resolve('/ties')}>団体戦カード</AppButton>
