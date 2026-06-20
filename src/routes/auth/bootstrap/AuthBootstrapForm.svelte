<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import type { FormInstance } from '$lib/types/forms';
	import { createAdminSchema } from './bootstrap.schema';

	let { form }: { form: FormInstance<typeof createAdminSchema> } = $props();
</script>

<form {...form} class="mt-6 space-y-4">
	<label class="grid gap-1.5">
		<span class="text-sm font-medium text-zinc-700">ID</span>
		<AppInput {...form.fields.accountId.as('text')} autocomplete="username" required />
	</label>

	<label class="grid gap-1.5">
		<span class="text-sm font-medium text-zinc-700">表示名</span>
		<AppInput {...form.fields.name.as('text')} required />
	</label>

	<label class="grid gap-1.5">
		<span class="text-sm font-medium text-zinc-700">パスワード</span>
		<AppInput {...form.fields.password.as('password')} autocomplete="new-password" required />
	</label>

	<AppButton type="submit" class="w-full" size="lg">作成</AppButton>
</form>
