export const statusBadgeColor = (
	status: string | null | undefined
): 'zinc' | 'amber' | 'blue' | 'violet' | 'green' | 'emerald' | 'orange' | 'red' | 'sky' => {
	const map: Record<string, 'zinc' | 'amber' | 'blue' | 'violet' | 'green' | 'emerald' | 'orange' | 'red' | 'sky'> = {
		scheduled: 'zinc',
		lineup_pending: 'amber',
		lineup_submitted: 'blue',
		ready: 'violet',
		called: 'blue',
		warmup: 'violet',
		playing: 'green',
		interval: 'amber',
		suspended: 'amber',
		finished: 'orange',
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
