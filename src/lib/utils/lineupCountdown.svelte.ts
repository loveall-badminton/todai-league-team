import { SvelteDate } from 'svelte/reactivity';

export function useLineupClock() {
	let now = $state(Date.now());

	$effect(() => {
		const timer = setInterval(() => {
			now = Date.now();
		}, 10_000);
		return () => clearInterval(timer);
	});

	function remainingMin(lineupDueAt: string | null | undefined): number | null {
		if (!lineupDueAt) return null;
		return Math.ceil((new SvelteDate(lineupDueAt).getTime() - now) / 60_000);
	}

	return { remainingMin };
}
