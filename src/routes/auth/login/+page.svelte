<script lang="ts">
	import { resolve } from '$app/paths';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { toast } from 'svelte-sonner';
	import Footer from '../../footer.svelte';
	import type { PageProps } from './$types';
	import { signIn } from './login.remote';

	let { data }: PageProps = $props();

	$effect(() => {
		if (signIn.result?.message) toast.error(signIn.result.message);
	});
</script>

<svelte:head>
	<title>ログイン | 東大リーグ団体戦</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10">
	<section class="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6">
		<PageHeader title="ログイン" />

		<form {...signIn} class="mt-6 space-y-4">
			<input
				{...signIn.fields.redirectTo.as('hidden', signIn.result?.redirectTo ?? data.redirectTo)}
			/>

			<label class="grid gap-1.5">
				<span class="text-sm font-medium text-zinc-700">ID</span>
				<AppInput
					type="text"
					autocomplete="username"
					{...signIn.fields.accountId.as('text')}
					required
				/>
			</label>

			<label class="grid gap-1.5">
				<span class="text-sm font-medium text-zinc-700">パスワード</span>
				<AppInput {...signIn.fields.password.as('password')} required />
			</label>

			<AppButton type="submit" class="w-full" size="lg">ログイン</AppButton>
		</form>

		{#if data.showBootstrap}
			<a
				href={resolve('/auth/bootstrap')}
				class="my-4 block text-center text-xs font-medium text-zinc-500"
			>
				初回管理者作成
			</a>
		{/if}

		<Footer class="pb-0" />
	</section>
</div>
