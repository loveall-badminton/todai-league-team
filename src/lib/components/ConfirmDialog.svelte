<script lang="ts">
	import { Dialog } from 'bits-ui';
	import AppButton from './AppButton.svelte';
	import { cn } from '$lib/utils/cn';

	type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning' | 'violet';
	type Size = 'sm' | 'md' | 'lg';

	let {
		formAction = '',
		hiddenFields = [],
		onConfirm = undefined,
		triggerLabel,
		triggerVariant = 'primary',
		triggerSize = 'md',
		triggerFullWidth = false,
		triggerClass = '',
		disabled = false,
		title,
		description,
		confirmLabel = '実行する',
		confirmVariant = 'primary',
		confirmClass = ''
	}: {
		formAction?: string;
		hiddenFields?: { name: string; value: string }[];
		onConfirm?: (() => void | Promise<void>) | undefined;
		triggerLabel: string;
		triggerVariant?: Variant;
		triggerSize?: Size;
		triggerFullWidth?: boolean;
		triggerClass?: string;
		disabled?: boolean;
		title: string;
		description?: string;
		confirmLabel?: string;
		confirmVariant?: Variant;
		confirmClass?: string;
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

	function attachForm(node: HTMLFormElement) {
		formEl = node;
		return () => {
			if (formEl === node) formEl = undefined;
		};
	}

	const triggerBase =
		'inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

	const triggerVariants = {
		primary: 'rounded-xl bg-zinc-950 font-medium text-white hover:bg-zinc-800',
		secondary:
			'rounded-xl border border-zinc-200 bg-white font-medium text-zinc-700 hover:bg-zinc-50',
		ghost: 'font-medium text-zinc-700 hover:text-zinc-950',
		danger: 'rounded-xl bg-red-600 font-bold text-white shadow-sm hover:bg-red-700',
		success: 'rounded-xl bg-emerald-700 font-medium text-white hover:bg-emerald-800',
		warning: 'rounded-xl bg-amber-100 font-medium text-amber-800 hover:bg-amber-200',
		violet:
			'rounded-lg border border-violet-200 bg-violet-50 font-medium text-violet-700 hover:bg-violet-100'
	} as const;

	const triggerSizes = {
		sm: 'px-3 py-1.5 text-xs',
		md: 'px-4 py-2 text-sm',
		lg: 'px-6 py-2.5 text-sm'
	} as const;

	let triggerStyles = $derived(
		cn(
			triggerBase,
			triggerVariants[triggerVariant],
			triggerSizes[triggerSize],
			triggerFullWidth && 'w-full',
			triggerClass
		)
	);
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger class={triggerStyles} {disabled}>
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
				<AppButton type="button" onclick={confirm} variant={confirmVariant} class={confirmClass}>
					{confirmLabel}
				</AppButton>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

{#if !onConfirm}
	<form {@attach attachForm} method="POST" action={formAction} class="hidden">
		{#each hiddenFields as field (field.name)}
			<input type="hidden" name={field.name} value={field.value} />
		{/each}
	</form>
{/if}
