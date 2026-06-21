<script lang="ts">
	import { resolve } from '$app/paths';
	import AppButton from '$lib/components/AppButton.svelte';
	import InlineMessage from '$lib/components/InlineMessage.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { toast } from 'svelte-sonner';
	import Footer from '$lib/components/Footer.svelte';
	import type { PageProps } from './$types';
	import { createAdmin } from './bootstrap.remote';
	import AuthBootstrapForm from './AuthBootstrapForm.svelte';

	let { data }: PageProps = $props();

	$effect(() => {
		const msg = createAdmin.result?.data?.message;
		if (msg) toast.error(msg);
	});
</script>

<svelte:head>
	<title>初回管理者作成 | 東大リーグ団体戦</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10">
	<section class="w-full max-w-sm rounded-lg border border-border bg-white p-6">
		<PageHeader title="初回管理者作成" />

		{#if data.hasUsers}
			<InlineMessage>初回管理者は作成済みです。</InlineMessage>
			<AppButton href={resolve('/auth/login')} class="mt-5 w-full" size="lg">ログインへ</AppButton>
		{:else}
			<AuthBootstrapForm />
		{/if}
		<Footer class="mt-4 pb-0" />
	</section>
</div>
