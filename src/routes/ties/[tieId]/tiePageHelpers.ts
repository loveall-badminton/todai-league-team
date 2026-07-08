export function rubberStatusTextClass(status: string): string {
	return (
		(
			{
				not_ready: 'text-zinc-400',
				ready: 'text-violet-600',
				scheduled: 'text-zinc-600',
				playing: 'text-green-700 font-medium',
				finished: 'text-orange-700',
				confirmed: 'text-emerald-700 font-medium',
				skipped: 'text-zinc-400',
				cancelled: 'text-red-600'
			} as Record<string, string>
		)[status] ?? 'text-zinc-500'
	);
}

export function submissionBadgeColor(
	status: string | null | undefined
): 'zinc' | 'blue' | 'violet' | 'emerald' {
	const map: Record<string, 'zinc' | 'blue' | 'violet' | 'emerald'> = {
		draft: 'zinc',
		submitted: 'blue',
		locked: 'violet',
		revealed: 'emerald'
	};
	return status ? (map[status] ?? 'zinc') : 'zinc';
}

export function getCurrentWorkflowStep(status: string, bothLineupsApproved = false): number {
	if (status === 'scheduled' || status === 'lineup_pending') return 1;
	if (status === 'lineup_submitted') return bothLineupsApproved ? 3 : 2;
	if (status === 'playing') return 4;
	if (status === 'finished' || status === 'confirmed') return 5;
	return 0;
}
