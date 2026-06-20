<script lang="ts">
	import { Dialog } from 'bits-ui';
	import type { FormInstance } from '$lib/types/forms';
	import { updateAccountSchema, resetPasswordSchema } from './accounts.schema';
	import type { SelectItem } from '$lib/types/ui';
	import { type Component } from 'svelte';
	import type { ManagedAccount } from '$lib/server/auth/accountManagement';
	import AccountEditDialogInner from './AccountEditDialogInner.svelte';

	let {
		open = $bindable(false),
		editAccount,
		updateAccount,
		resetPassword,
		accountTypeItems,
		accountTypeValue,
		accountTypeBadgeColor,
		accountTypeLabel,
		accountTypeIcon: AcctIcon,
		teamItems
	}: {
		open: boolean;
		editAccount: ManagedAccount | null;
		updateAccount: FormInstance<typeof updateAccountSchema>;
		resetPassword: FormInstance<typeof resetPasswordSchema>;
		accountTypeItems: SelectItem[];
		accountTypeValue: (account: ManagedAccount) => string;
		accountTypeBadgeColor: (value: string) => 'red' | 'blue' | 'zinc';
		accountTypeLabel: (value: string) => string;
		accountTypeIcon: (value: string) => Component;
		teamItems: SelectItem[];
	} = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl outline-none"
		>
			{#if editAccount}
				{#key editAccount.id}
					<AccountEditDialogInner
						{editAccount}
						{updateAccount}
						{resetPassword}
						{accountTypeItems}
						{accountTypeValue}
						{accountTypeBadgeColor}
						{accountTypeLabel}
						accountTypeIcon={AcctIcon}
						{teamItems}
					/>
				{/key}
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
