export type TieFilter =
	| 'all'
	| 'group_a'
	| 'group_b'
	| 'semifinal'
	| 'final'
	| 'third_place'
	| 'fifth_place'
	| 'lineup_pending'
	| 'playing'
	| 'finished'
	| 'schedule_changed';

export const VALID_TIE_FILTERS: TieFilter[] = [
	'all',
	'group_a',
	'group_b',
	'semifinal',
	'final',
	'third_place',
	'fifth_place',
	'lineup_pending',
	'playing',
	'finished',
	'schedule_changed'
];

export type FilterableTie = {
	phase: string;
	status: string;
	scheduleChanged: boolean;
};

export function tieMatchesFilter(tie: FilterableTie, filter: TieFilter): boolean {
	if (filter === 'all') return true;
	if (filter === 'group_a') return tie.phase === 'group_a';
	if (filter === 'group_b') return tie.phase === 'group_b';
	if (filter === 'semifinal') return tie.phase === 'semifinal';
	if (filter === 'final') return tie.phase === 'final';
	if (filter === 'third_place') return tie.phase === 'third_place';
	if (filter === 'fifth_place') return tie.phase === 'fifth_place';
	if (filter === 'lineup_pending') return tie.status === 'lineup_pending';
	if (filter === 'playing') return tie.status === 'playing';
	if (filter === 'finished') return tie.status === 'finished';
	if (filter === 'schedule_changed') return tie.scheduleChanged;
	return true;
}
