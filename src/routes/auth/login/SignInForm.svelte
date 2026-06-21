<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import { signIn } from './login.remote';

	let { redirectTo }: { redirectTo: string } = $props();

	$effect(() => {
		signIn.fields.set({ redirectTo, accountId: '', password: '' });
	});
</script>

<form {...signIn} class="mt-6 space-y-4">
	<input {...signIn.fields.redirectTo.as('hidden', '')} />

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
