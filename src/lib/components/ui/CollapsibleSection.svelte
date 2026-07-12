<script lang="ts">
	import { Collapsible } from 'bits-ui';
	import { cn } from '$lib/utils/cn';
	import { ChevronDown } from '@lucide/svelte';

	let {
		title,
		class: className = '',
		children
	}: {
		title: string;
		class?: string;
		children?: import('svelte').Snippet;
	} = $props();
</script>

<Collapsible.Root>
	<Collapsible.Trigger
		class={cn(
			'group flex w-full cursor-pointer items-center justify-between px-5 py-3 text-sm font-medium text-zinc-700 outline-none hover:bg-zinc-100',
			className
		)}
	>
		{title}
		<ChevronDown
			class={cn(
				'size-4 shrink-0 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180'
			)}
		/>
	</Collapsible.Trigger>
	<Collapsible.Content
		class="grid transition-all duration-200 ease-out data-[state=closed]:grid-rows-[0fr] data-[state=open]:grid-rows-[1fr]"
	>
		<div class="overflow-hidden px-5 py-4">
			{@render children?.()}
		</div>
	</Collapsible.Content>
</Collapsible.Root>
