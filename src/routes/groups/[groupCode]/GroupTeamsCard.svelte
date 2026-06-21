<script lang="ts">
	import { resolve } from '$app/paths';
	import Card from '$lib/components/Card.svelte';

	let { teams }: { teams: { id: string; name: string; playerCount: number }[] } = $props();
</script>

<Card>
	<h2 class="text-sm font-medium tracking-wide text-muted-foreground">所属チーム</h2>
	<div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
		{#each teams as team (team.id)}
			<a
				class="flex items-center justify-between rounded-xl border border-border-subtle px-4 py-3 hover:border-zinc-300"
				href={resolve('/teams/[teamId]', { teamId: team.id })}
			>
				<span class="text-sm font-medium">{team.name}</span>
				<span class="text-xs text-muted-foreground">{team.playerCount}名</span>
			</a>
		{:else}
			<p class="col-span-full text-sm text-muted-foreground">チームが登録されていません。</p>
		{/each}
	</div>
</Card>
