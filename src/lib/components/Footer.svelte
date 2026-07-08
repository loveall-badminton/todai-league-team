<script lang="ts">
	import GitHub from '$lib/icons/github.svelte';
	import { cn } from '$lib/utils/cn';

	let { class: className }: { class?: string } = $props();
</script>

<footer
	class={cn(
		'border-t border-border bg-white p-4 text-xs text-muted-foreground @container',
		className
	)}
>
	<div
		class="mx-auto flex max-w-7xl flex-col items-center justify-center gap-3 @sm:flex-row @sm:gap-4"
	>
		<p class="flex flex-col @sm:flex-row flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
			<span>
				Developed by
				<strong class="font-bold text-foreground">LOVE ALL</strong>
			</span>

			<span class="hidden text-muted-foreground/75 select-none @sm:inline" aria-hidden="true"
				>·</span
			>

			<span>
				Licensed under
				<a
					href="https://opensource.org/license/mit"
					target="_blank"
					rel="noreferrer"
					class="text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
				>
					MIT License
				</a>
			</span>
		</p>

		<a
			href="https://github.com/loveall-badminton/todai-league-team"
			target="_blank"
			rel="noreferrer"
			aria-label="GitHub リポジトリ"
			class="inline-flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
		>
			<GitHub class="size-4" aria-hidden="true" />
		</a>
	</div>
</footer>
