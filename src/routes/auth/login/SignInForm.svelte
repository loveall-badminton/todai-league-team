<script lang="ts">
	import { Eye, EyeOff } from '@lucide/svelte';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import { signIn } from './login.remote';

	let { redirectTo }: { redirectTo: string } = $props();
	let showPassword = $state(false);
</script>

<form {...signIn} class="mt-6 space-y-4">
	<input {...signIn.fields.redirectTo.as('hidden', redirectTo)} />

	<label class="grid gap-1.5">
		<span class="text-sm font-medium text-zinc-700">ID</span>
		<AppInput
			type="text"
			autocomplete="username"
			{...signIn.fields.accountId.as('text', '')}
			required
		/>
	</label>

	<label class="grid gap-1.5">
		<span class="text-sm font-medium text-zinc-700">パスワード</span>
		<span class="relative">
			<AppInput
				autocomplete="current-password"
				{...signIn.fields.password.as(showPassword ? 'text' : 'password', '')}
				required
			/>
			<button
				type="button"
				class="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-default"
				onclick={() => (showPassword = !showPassword)}
				aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
				tabindex="-1"
			>
				{#if showPassword}
					<EyeOff class="size-4" />
				{:else}
					<Eye class="size-4" />
				{/if}
			</button>
		</span>
	</label>

	<AppButton type="submit" class="w-full" size="lg">ログイン</AppButton>
</form>
