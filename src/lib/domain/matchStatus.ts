import type { MatchStatus } from './types';

/**
 * 試合ステータスの分類とラバー(種目)ステータスへの射影。
 * 進行管理の判定はすべてここを参照し、リテラル配列の重複を作らない。
 */

/** これ以上スコアイベントで状態が進まない終局ステータス */
export const TERMINAL_MATCH_STATUSES = [
	'finished',
	'forfeited',
	'retired',
	'confirmed',
	'cancelled'
] as const satisfies readonly MatchStatus[];

/** コート上で試合が動いている(=中断・インターバル含む)ステータス */
export const ACTIVE_MATCH_STATUSES = [
	'playing',
	'interval',
	'suspended'
] as const satisfies readonly MatchStatus[];

/** 勝敗結果を持ち、承認(confirm)の対象になりうるステータス */
export const CONFIRMABLE_MATCH_STATUSES = [
	'finished',
	'forfeited',
	'retired'
] as const satisfies readonly MatchStatus[];

/** 勝敗結果が確定しているステータス(承認済みを含む) */
export const RESULT_MATCH_STATUSES = [
	'finished',
	'forfeited',
	'retired',
	'confirmed'
] as const satisfies readonly MatchStatus[];

export function isTerminalMatchStatus(status: string): boolean {
	return (TERMINAL_MATCH_STATUSES as readonly string[]).includes(status);
}

export function isActiveMatchStatus(status: string): boolean {
	return (ACTIVE_MATCH_STATUSES as readonly string[]).includes(status);
}

export function isConfirmableMatchStatus(status: string): boolean {
	return (CONFIRMABLE_MATCH_STATUSES as readonly string[]).includes(status);
}

export function isResultMatchStatus(status: string): boolean {
	return (RESULT_MATCH_STATUSES as readonly string[]).includes(status);
}

/** rubbers.status が取りうる値(DB スキーマと一致させる) */
export type RubberStatus =
	| 'not_ready'
	| 'ready'
	| 'scheduled'
	| 'playing'
	| 'finished'
	| 'confirmed'
	| 'skipped'
	| 'cancelled';

/** これ以上進行しない(=対抗戦の消化済みとして数える)ラバーのステータス */
export const TERMINAL_RUBBER_STATUSES = [
	'finished',
	'confirmed',
	'skipped',
	'cancelled'
] as const satisfies readonly RubberStatus[];

export function isTerminalRubberStatus(status: string): boolean {
	return (TERMINAL_RUBBER_STATUSES as readonly string[]).includes(status);
}

/**
 * 試合ステータスをラバー表示用ステータスに射影する。
 * DB 上の matches.status は MatchState に無い 'called' / 'warmup' も含むため string を受ける。
 * 対応が無いステータスは null(呼び出し側で「更新しない」等の扱いにする)。
 */
export function rubberStatusForMatchStatus(matchStatus: string): RubberStatus | null {
	if (matchStatus === 'confirmed') return 'confirmed';
	if (isConfirmableMatchStatus(matchStatus)) return 'finished';
	if (isActiveMatchStatus(matchStatus)) return 'playing';
	if (['scheduled', 'called', 'warmup'].includes(matchStatus)) return 'scheduled';
	if (matchStatus === 'cancelled') return 'cancelled';
	return null;
}
