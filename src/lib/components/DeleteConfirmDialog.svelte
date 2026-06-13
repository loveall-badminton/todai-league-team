<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { cn } from '$lib/utils/cn';

	let {
		formAction = '',
		hiddenFields = [],
		onConfirm = undefined,
		triggerLabel,
		title,
		description
	}: {
		formAction?: string;
		hiddenFields?: { name: string; value: string }[];
		onConfirm?: (() => void | Promise<void>) | undefined;
		triggerLabel: string;
		title: string;
		description?: string;
	} = $props();

	let open = $state(false);
	let formEl: HTMLFormElement | undefined = $state();

	function confirm() {
		open = false;
		if (onConfirm) {
			onConfirm();
			return;
		}
		formEl?.requestSubmit();
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger class={cn('text-xs text-red-500 hover:text-red-700 hover:underline')}>
		{triggerLabel}
	</Dialog.Trigger>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl outline-none"
		>
			<Dialog.Title class="text-base font-semibold text-zinc-950">{title}</Dialog.Title>
			{#if description}
				<Dialog.Description class="mt-2 text-sm text-zinc-500">{description}</Dialog.Description>
			{/if}
			<div class="mt-6 flex justify-end gap-2">
				<Dialog.Close
					class="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
				>
					キャンセル
				</Dialog.Close>
				<button
					type="button"
					onclick={confirm}
					class={cn(
						'rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700'
					)}
				>
					削除する
				</button>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

{#if !onConfirm}
	<form bind:this={formEl} method="POST" action={formAction} class="hidden">
		{#each hiddenFields as field (field.name)}
			<input type="hidden" name={field.name} value={field.value} />
		{/each}
	</form>
{/if}
