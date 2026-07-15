<script lang="ts">
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import AppInput from '$lib/components/ui/AppInput.svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createAdmin } from './bootstrap.remote';

	const enhancedForm = createAdmin.enhance(async (form) => {
		await form.submit();
		const result = createAdmin.result;
		if (!result) return;
		if ('ok' in result) {
			goto(resolve('/auth/login'));
			return;
		}
		const msg = result.data?.message;
		if (msg) toast.error(msg);
	});
</script>

<form {...enhancedForm} class="mt-6 space-y-4">
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
