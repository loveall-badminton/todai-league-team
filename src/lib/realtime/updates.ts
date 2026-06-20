import { groupPhaseFor, type GroupCode, type TiePhase } from '$lib/domain/tokyoLeague';
import { hasScoreUpdate, type LiveTopic, type LiveUpdateData } from './channels';

export interface RealtimeUpdate {
	topics: LiveTopic[];
	data?: LiveUpdateData;
	source: 'live' | 'poll';
	channel: string;
	at?: string;
}

const FINALS_PHASES: readonly TiePhase[] = ['semifinal', 'fifth_place', 'third_place', 'final'];
const TERMINAL_SCORE_STATUSES = new Set([
	'finished',
	'forfeited',
	'retired',
	'confirmed',
	'cancelled'
] as const);

function hasRelevantTieId(
	candidateTieIds: readonly string[] | undefined,
	relevantTieIds: Set<string>
) {
	return candidateTieIds?.some((tieId) => relevantTieIds.has(tieId)) ?? false;
}

function hasRelevantPhase(
	candidatePhases: readonly TiePhase[] | undefined,
	relevantPhases: readonly TiePhase[]
) {
	return candidatePhases?.some((phase) => relevantPhases.includes(phase)) ?? false;
}

function matchesScheduleScope(
	update: RealtimeUpdate,
	relevantScopes: readonly ('tie_header' | 'lineups' | 'rubbers')[]
) {
	const scopes = update.data?.schedule?.scopes;
	if (!scopes || scopes.length === 0) return true;
	return scopes.some((scope) => relevantScopes.includes(scope));
}

export function shouldRefreshFinalsPage(
	update: RealtimeUpdate,
	relevantTieIds: Iterable<string>
): boolean {
	if (update.source === 'poll') return true;
	const tieIdSet = new Set(relevantTieIds);

	if (update.topics.includes('finals')) {
		const payload = update.data?.finals;
		if (!payload) return true;
		if (!payload.tieIds && !payload.phases) return true;
		if (hasRelevantTieId(payload.tieIds, tieIdSet)) return true;
		if (hasRelevantPhase(payload.phases, FINALS_PHASES)) return true;
	}

	if (update.topics.includes('schedule')) {
		const payload = update.data?.schedule;
		if (!payload) return true;
		if (!payload.tieIds && !payload.phases) return true;
		if (hasRelevantTieId(payload.tieIds, tieIdSet)) return true;
		if (hasRelevantPhase(payload.phases, FINALS_PHASES)) return true;
	}

	return false;
}

export function shouldRefreshGroupPage(
	update: RealtimeUpdate,
	groupCode: GroupCode,
	relevantTieIds: Iterable<string>
): boolean {
	if (update.source === 'poll') return true;
	const tieIdSet = new Set(relevantTieIds);
	const groupPhase = groupPhaseFor(groupCode);

	if (update.topics.includes('standings')) {
		const payload = update.data?.standings;
		if (!payload) return true;
		if (!payload.groupCodes && !payload.tieIds) return true;
		if (payload.groupCodes?.includes(groupCode)) return true;
		if (hasRelevantTieId(payload.tieIds, tieIdSet)) return true;
	}

	if (update.topics.includes('schedule')) {
		const payload = update.data?.schedule;
		if (!payload) return true;
		if (!payload.tieIds && !payload.phases) return true;
		if (hasRelevantTieId(payload.tieIds, tieIdSet)) return true;
		if (payload.phases?.includes(groupPhase)) return true;
	}

	return false;
}

export function shouldRefreshTiesPage(update: RealtimeUpdate): boolean {
	if (update.source === 'poll') return true;
	if (update.topics.includes('schedule')) return true;
	if (!update.topics.includes('score')) return false;
	if (!hasScoreUpdate(update.data)) return true;
	return TERMINAL_SCORE_STATUSES.has(update.data.score.state.status);
}

export function shouldRefreshTieHeaderData(update: RealtimeUpdate, tieId: string): boolean {
	if (update.source === 'poll') return true;

	if (update.topics.includes('schedule')) {
		const payload = update.data?.schedule;
		if (!payload) return true;
		if (!payload.tieIds && !payload.phases) return true;
		if (payload.tieIds?.includes(tieId)) {
			return matchesScheduleScope(update, ['tie_header']);
		}
	}

	if (update.topics.includes('standings')) {
		const payload = update.data?.standings;
		if (!payload) return true;
		if (!payload.tieIds && !payload.groupCodes) return true;
		if (payload.tieIds?.includes(tieId)) return true;
	}

	if (update.topics.includes('finals')) {
		const payload = update.data?.finals;
		if (!payload) return true;
		if (!payload.tieIds && !payload.phases) return true;
		if (payload.tieIds?.includes(tieId)) return true;
	}

	return false;
}

export function shouldRefreshTieLineups(update: RealtimeUpdate, tieId: string): boolean {
	if (update.source === 'poll') return true;
	if (!update.topics.includes('schedule')) return false;

	const payload = update.data?.schedule;
	if (!payload) return true;
	if (!payload.tieIds && !payload.phases) return true;
	if (!payload.tieIds?.includes(tieId)) return false;
	return matchesScheduleScope(update, ['lineups']);
}

export function shouldRefreshTieLiveRubbers(
	update: RealtimeUpdate,
	tieId: string,
	matchIds: Iterable<string>
): boolean {
	if (update.source === 'poll') return true;

	if (update.topics.includes('score')) {
		if (!hasScoreUpdate(update.data)) return true;
		const matchIdSet = new Set(matchIds);
		return matchIdSet.has(update.data.score.state.matchId);
	}

	if (update.topics.includes('schedule')) {
		const payload = update.data?.schedule;
		if (!payload) return true;
		if (!payload.tieIds && !payload.phases) return true;
		if (!(payload.tieIds?.includes(tieId) ?? false)) return false;
		return matchesScheduleScope(update, ['rubbers']);
	}

	return false;
}

export function shouldRefreshDashboardPlaying(update: RealtimeUpdate): boolean {
	if (update.source === 'poll') return true;
	if (update.topics.includes('schedule')) return true;
	if (!update.topics.includes('score')) return false;
	if (!hasScoreUpdate(update.data)) return true;
	return TERMINAL_SCORE_STATUSES.has(update.data.score.state.status);
}

export function shouldRefreshDashboardRecent(update: RealtimeUpdate): boolean {
	if (update.source === 'poll') return true;
	if (update.topics.includes('schedule')) return true;
	if (!update.topics.includes('score')) return false;
	if (!hasScoreUpdate(update.data)) return true;
	return TERMINAL_SCORE_STATUSES.has(update.data.score.state.status);
}
