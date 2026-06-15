<script lang="ts">
	import { untrack } from 'svelte';
	import { VENUES } from '$lib/domain/tokyoLeague';
	import { venueCourtCount, parseCourts } from '$lib/domain/tokyoLeagueLabels';
	import AppSelect from './AppSelect.svelte';
	import AppCheckbox from './AppCheckbox.svelte';

	let {
		initialVenue = '',
		initialCourts = ''
	}: { initialVenue?: string | null; initialCourts?: string | null } = $props();

	let venue = $state(untrack(() => initialVenue ?? ''));
	let selected = $state<number[]>(untrack(() => parseCourts(initialCourts)));

	let courtCount = $derived(venueCourtCount(venue));
	let courts = $derived(Array.from({ length: courtCount }, (_, i) => i + 1));
	let jsonValue = $derived(selected.length > 0 ? JSON.stringify(selected) : '');

	const venueItems = [
		{ value: '', label: '未設定' },
		...VENUES.map((v) => ({ value: v.code, label: v.label }))
	];

	function handleVenueChange(next: string) {
		if (next !== venue) {
			selected = [];
			venue = next;
		}
	}

	function toggleCourt(n: number) {
		if (selected.includes(n)) {
			selected = selected.filter((x) => x !== n);
		} else {
			selected = [...selected, n].sort((a, b) => a - b);
		}
	}
</script>

<div class="space-y-2">
	<AppSelect
		name="venue"
		value={venue}
		items={venueItems}
		placeholder="体育館を選択"
		onValueChange={handleVenueChange}
	/>

	{#if courts.length > 0}
		<div class="flex flex-wrap gap-x-4 gap-y-2">
			{#each courts as n (n)}
				<AppCheckbox
					checked={selected.includes(n)}
					label="{n}面"
					onCheckedChange={() => toggleCourt(n)}
				/>
			{/each}
		</div>
	{:else if venue}
		<p class="text-xs text-zinc-400">コートなし</p>
	{:else}
		<p class="text-xs text-zinc-400">体育館を選ぶとコートが表示されます</p>
	{/if}

	<input type="hidden" name="courtBlockCode" data-testid="court-block-input" value={jsonValue} />
</div>
