<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import AppInput from '$lib/components/AppInput.svelte';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>初回管理者作成 | 東大リーグ団体戦</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10">
	<section class="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6">
		<div class="space-y-1">
			<p class="text-sm font-medium text-zinc-500">初回設定</p>
			<h1 class="text-xl font-semibold text-zinc-950">初回管理者作成</h1>
		</div>

		{#if data.hasUsers}
			<p class="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
				初回管理者は作成済みです。
			</p>
			<a
				href={resolve('/auth/login')}
				class="mt-5 block rounded-lg bg-zinc-950 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-zinc-800"
			>
				ログインへ
			</a>
		{:else}
			{#if form?.message}
				<p class="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
					{form.message}
				</p>
			{/if}

			<form method="POST" action="?/createAdmin" class="mt-6 space-y-4">
				<label class="grid gap-1.5">
					<span class="text-sm font-medium text-zinc-700">ID</span>
					<AppInput
						name="accountId"
						type="text"
						autocomplete="username"
						value={form?.accountId ?? ''}
						required
					/>
				</label>

				<label class="grid gap-1.5">
					<span class="text-sm font-medium text-zinc-700">表示名</span>
					<AppInput name="name" value={form?.name ?? ''} required />
				</label>

				<label class="grid gap-1.5">
					<span class="text-sm font-medium text-zinc-700">パスワード</span>
					<AppInput name="password" type="password" autocomplete="new-password" required />
				</label>

				<button
					class="w-full rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
				>
					作成
				</button>
			</form>
		{/if}
	</section>
</div>
