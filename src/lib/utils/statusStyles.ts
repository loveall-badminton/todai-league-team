export const statusBadgeColor = (
	status: string | null | undefined
): 'zinc' | 'amber' | 'blue' | 'violet' | 'emerald' | 'red' => {
	const map: Record<string, 'zinc' | 'amber' | 'blue' | 'violet' | 'emerald' | 'red'> = {
		scheduled: 'zinc',
		lineup_pending: 'amber',
		lineup_submitted: 'blue',
		ready: 'violet',
		called: 'blue',
		warmup: 'violet',
		playing: 'emerald',
		interval: 'amber',
		suspended: 'amber',
		finished: 'amber',
		forfeited: 'red',
		retired: 'red',
		confirmed: 'emerald',
		cancelled: 'red',
		not_ready: 'zinc',
		skipped: 'zinc',
		submitted: 'blue',
		locked: 'violet',
		revealed: 'emerald',
		draft: 'zinc'
	};
	return map[status ?? ''] ?? 'zinc';
};

export const groupBadgeColor = (groupCode: string | null): 'blue' | 'violet' | 'zinc' => {
	if (groupCode === 'A') return 'blue';
	if (groupCode === 'B') return 'violet';
	return 'zinc';
};
