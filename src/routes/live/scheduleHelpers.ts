export function statusDot(status: string): string {
	if (status === 'playing') return 'bg-emerald-500 animate-pulse';
	if (['finished', 'confirmed'].includes(status)) return 'bg-zinc-300';
	if (['forfeited', 'cancelled'].includes(status)) return 'bg-red-300';
	return 'bg-amber-400';
}

export function statusText(status: string): string {
	if (status === 'playing') return 'text-emerald-700 font-medium';
	if (['finished', 'confirmed'].includes(status)) return 'text-zinc-400';
	return 'text-zinc-500';
}

export function groupTiesByPhase<T extends { phase: string }>(
	ties: T[]
): { phase: string; ties: T[] }[] {
	return ties.reduce<{ phase: string; ties: T[] }[]>((acc, tie) => {
		const group = acc.find((g) => g.phase === tie.phase);
		if (group) group.ties.push(tie);
		else acc.push({ phase: tie.phase, ties: [tie] });
		return acc;
	}, []);
}
