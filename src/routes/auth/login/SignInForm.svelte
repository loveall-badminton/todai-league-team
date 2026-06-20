<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import type { FormInstance } from '$lib/types/forms';
	import { signInSchema } from './login.schema';

	let {
		form,
		redirectTo
	}: {
		form: FormInstance<typeof signInSchema>;
		redirectTo: string;
	} = $props();

	$effect(() => {
		form.fields.set({ redirectTo, accountId: '', password: '' });
	});
</script>

<form {...form} class="mt-6 space-y-4">
	<input {...form.fields.redirectTo.as('hidden', '')} />

	<label class="grid gap-1.5">
		<span class="text-sm font-medium text-zinc-700">ID</span>
		<AppInput type="text" autocomplete="username" {...form.fields.accountId.as('text')} required />
	</label>

	<label class="grid gap-1.5">
		<span class="text-sm font-medium text-zinc-700">パスワード</span>
		<AppInput {...form.fields.password.as('password')} required />
	</label>

	<AppButton type="submit" class="w-full" size="lg">ログイン</AppButton>
</form>
