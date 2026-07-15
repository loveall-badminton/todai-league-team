<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import type { PageProps } from './$types';
	import { signIn } from './login.remote';
	import SignInForm from './SignInForm.svelte';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>ログイン | 東大リーグ団体戦</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10">
	<section class="w-full max-w-sm rounded-lg border border-border bg-white p-6">
		<PageHeader title="ログイン" />

		<SignInForm redirectTo={signIn.result?.redirectTo ?? data.redirectTo} />

		{#if data.showBootstrap}
			<a
				href={resolve('/auth/bootstrap')}
				class="my-4 block text-center text-xs font-medium text-muted-foreground"
			>
				初回管理者作成
			</a>
		{/if}

		<Footer class="pb-0 mt-4" />
	</section>
</div>
