<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.doc.title} | 使い方ガイド | 東大リーグ団体戦</title>
	<meta name="description" content={data.doc.description ?? data.doc.title} />
</svelte:head>

<article class="doc-content prose max-w-2xl min-w-0">
	<PageHeader title={data.doc.title} class="border-b border-zinc-200" />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html data.doc.html}
</article>
