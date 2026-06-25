<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let {
		sections,
		onNavigate
	}: {
		sections: { title: string; docs: { title: string; slug: string }[] }[];
		onNavigate?: () => void;
	} = $props();

	function isActive(slug: string) {
		const pathname = page.url.pathname;
		const base = '/docs';
		const target = slug ? `${base}/${slug}` : base;
		return pathname === target || pathname.startsWith(`${target}/`);
	}
</script>

<nav class="flex flex-col gap-0.5">
	{#each sections as section (section.title)}
		<div class="mt-5 first:mt-0">
			<p class="px-3 text-xs font-semibold tracking-tight text-muted-foreground uppercase">
				{section.title}
			</p>
			<div class="mt-1.5 flex flex-col gap-0.5">
				{#each section.docs as doc (doc.slug)}
					<a
						href={resolve(doc.slug ? `/docs/${doc.slug}` : '/docs')}
						onclick={onNavigate}
						class="block rounded-lg px-3 py-1.5 text-sm transition-colors {isActive(doc.slug)
							? 'bg-zinc-100 font-medium text-zinc-900'
							: 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800'}"
					>
						{doc.title}
					</a>
				{/each}
			</div>
		</div>
	{/each}
</nav>
