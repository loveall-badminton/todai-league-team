import type { TieStatus } from '$lib/domain/tieProgress';

// 一覧画面でフィルタとして提供するステータスのサブセット。
// TieStatus からの逸脱(タイプミスや廃止漏れ)は satisfies で検出する。
const STATUS_FILTERS = [
	'lineup_pending',
	'lineup_submitted',
	'playing',
	'finished'
] as const satisfies readonly TieStatus[];

export type TieFilter =
	'all' | 'group_a' | 'group_b' | 'finals' | (typeof STATUS_FILTERS)[number] | 'schedule_changed';

export const VALID_TIE_FILTERS: TieFilter[] = [
	'all',
	'group_a',
	'group_b',
	'finals',
	...STATUS_FILTERS,
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
	if (filter === 'schedule_changed') return tie.scheduleChanged;
	if ((STATUS_FILTERS as readonly string[]).includes(filter)) return tie.status === filter;
	return true;
}
