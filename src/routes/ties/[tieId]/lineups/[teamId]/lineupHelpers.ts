export interface LineupItem {
	rubberCode: string;
	player1Id: string | null;
	player2Id: string | null;
}

export function lineupStatusBadgeClass(status: string | null): string {
	const map: Record<string, string> = {
		draft: 'bg-zinc-100 text-zinc-600',
		submitted: 'bg-blue-100 text-blue-700',
		locked: 'bg-violet-100 text-violet-700',
		revealed: 'bg-emerald-100 text-emerald-700'
	};
	return status ? (map[status] ?? 'bg-zinc-100 text-zinc-500') : 'bg-zinc-100 text-zinc-400';
}

export function filteredPlayers<P extends { gender: string }>(
	discipline: string,
	order: 1 | 2,
	players: P[]
): P[] {
	return players.filter((p) => {
		if (p.gender === 'unknown') return true;
		if (discipline === 'WD') return p.gender === 'female';
		if (discipline === 'MD') return p.gender === 'male';
		if (discipline === 'XD') return order === 1 ? p.gender === 'female' : p.gender === 'male';
		return true;
	});
}

export function slotLabel(discipline: string, order: 1 | 2): string {
	if (discipline === 'XD') return order === 1 ? '女性' : '男性';
	return `${order}人目`;
}

export function savedPlayerValue(rubberCode: string, order: 1 | 2, items: LineupItem[]): string {
	const item = items.find((i) => i.rubberCode === rubberCode);
	return order === 1 ? (item?.player1Id ?? '') : (item?.player2Id ?? '');
}
