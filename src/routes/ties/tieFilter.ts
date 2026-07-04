export type TieFilter =
	| 'all'
	| 'group_a'
	| 'group_b'
	| 'finals'
	| 'lineup_pending'
	| 'lineup_submitted'
	| 'ready'
	| 'playing'
	| 'finished'
	| 'schedule_changed';

export const VALID_TIE_FILTERS: TieFilter[] = [
	'all',
	'group_a',
	'group_b',
	'finals',
	'lineup_pending',
	'lineup_submitted',
	'ready',
	'playing',
	'finished',
	'schedule_changed'
];

export type FilterableTie = {
	phase: string;
	status: string;
	scheduleChanged: boolean;
};

const FINALS_PHASES = ['semifinal', 'final', 'third_place', 'fifth_place'];

export function tieMatchesFilter(tie: FilterableTie, filter: TieFilter): boolean {
	if (filter === 'all') return true;
	if (filter === 'group_a') return tie.phase === 'group_a';
	if (filter === 'group_b') return tie.phase === 'group_b';
	if (filter === 'finals') return FINALS_PHASES.includes(tie.phase);
	if (filter === 'lineup_pending') return tie.status === 'lineup_pending';
	if (filter === 'lineup_submitted') return tie.status === 'lineup_submitted';
	if (filter === 'ready') return tie.status === 'ready';
	if (filter === 'playing') return tie.status === 'playing';
	if (filter === 'finished') return tie.status === 'finished';
	if (filter === 'schedule_changed') return tie.scheduleChanged;
	return true;
}
