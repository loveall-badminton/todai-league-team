<script lang="ts">
	import { resolve } from '$app/paths';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import InlineMessage from '$lib/components/InlineMessage.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { toast } from 'svelte-sonner';
	import Footer from '../../footer.svelte';
	import type { PageProps } from './$types';
	import { createAdmin } from './bootstrap.remote';

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
	<section class="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6">
		<PageHeader title="初回管理者作成" />

		{#if data.hasUsers}
			<InlineMessage>初回管理者は作成済みです。</InlineMessage>
			<AppButton href={resolve('/auth/login')} class="mt-5 w-full" size="lg">ログインへ</AppButton>
		{:else}
			<form {...createAdmin} class="mt-6 space-y-4">
				<label class="grid gap-1.5">
					<span class="text-sm font-medium text-zinc-700">ID</span>
					<AppInput {...createAdmin.fields.accountId.as('text')} autocomplete="username" required />
				</label>

				<label class="grid gap-1.5">
					<span class="text-sm font-medium text-zinc-700">表示名</span>
					<AppInput {...createAdmin.fields.name.as('text')} required />
				</label>

				<label class="grid gap-1.5">
					<span class="text-sm font-medium text-zinc-700">パスワード</span>
					<AppInput
						{...createAdmin.fields.password.as('password')}
						autocomplete="new-password"
						required
					/>
				</label>

				<AppButton type="submit" class="w-full" size="lg">作成</AppButton>
			</form>
		{/if}
		<Footer class="mt-4 pb-0" />
	</section>
</div>
