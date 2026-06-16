import { command, form } from '$app/server';
import { groupPhaseFor, type TiePhase } from '$lib/domain/tokyoLeague';
import { requireAdmin } from '$lib/server/auth/access';
import {
	assignOfficiatingTeams,
	listTies,
	reorderTies,
	updateTieSchedule
} from '$lib/server/repositories/tokyoLeagueRepository';
import { notifyLiveBoard } from '$lib/server/realtime/broadcast';
import { createTieWithRubbers } from '$lib/server/services/tieService';
import { redirect } from '@sveltejs/kit';
import * as v from 'valibot';

const emptyToNull = (s: string | undefined | null): string | null => {
	const text = (s ?? '').trim();
	return text === '' ? null : text;
};

const uniqueNonEmpty = (values: string[] | undefined): string[] => [
	...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))
];

const venueOrNull = (s: string | undefined | null): 'first_gym' | 'second_gym' | null => {
	if (s === 'first_gym' || s === 'second_gym') return s;
	return null;
};

const policyFromValue = (
	s: string | undefined | null
): 'first_match_before_opening' | 'ten_minutes_before' | 'manual' => {
	if (s === 'first_match_before_opening' || s === 'manual') return s;
	return 'ten_minutes_before';
};

export const create = form(
	v.object({
		tieCode: v.pipe(v.string(), v.trim(), v.minLength(1, 'コードは必須です')),
		scoringRuleId: v.pipe(v.string(), v.trim(), v.minLength(1, '得点ルールは必須です')),
		groupCode: v.optional(v.string()),
		phase: v.optional(v.string()),
		scheduledStartAt: v.optional(v.string()),
		teamAId: v.optional(v.string()),
		teamBId: v.optional(v.string()),
		roundLabel: v.optional(v.string()),
		venue: v.optional(v.string()),
		courtBlockCode: v.optional(v.string()),
		lineupDueAt: v.optional(v.string()),
		lineupDuePolicy: v.optional(v.string())
	}),
	async ({
		tieCode,
		scoringRuleId,
		groupCode,
		phase,
		scheduledStartAt,
		teamAId,
		teamBId,
		roundLabel,
		venue,
		courtBlockCode,
		lineupDueAt,
		lineupDuePolicy
	}) => {
		requireAdmin();
		const resolvedGroupCode: 'A' | 'B' | null =
			groupCode === 'A' || groupCode === 'B' ? groupCode : null;
		const resolvedPhase: TiePhase = resolvedGroupCode
			? groupPhaseFor(resolvedGroupCode)
			: (() => {
					if (
						phase === 'semifinal' ||
						phase === 'final' ||
						phase === 'third_place' ||
						phase === 'fifth_place' ||
						phase === 'ranking_tiebreaker'
					) {
						return phase;
					}
					return 'semifinal';
				})();

		const existing = await listTies();
		const id = await createTieWithRubbers({
			tieCode,
			phase: resolvedPhase,
			groupCode: resolvedGroupCode,
			roundLabel: emptyToNull(roundLabel),
			teamAId: emptyToNull(teamAId),
			teamBId: emptyToNull(teamBId),
			scheduledStartAt: emptyToNull(scheduledStartAt),
			venue: venueOrNull(venue),
			courtBlockCode: emptyToNull(courtBlockCode),
			lineupDueAt: emptyToNull(lineupDueAt),
			lineupDuePolicy: policyFromValue(lineupDuePolicy),
			scoringRuleId,
			displayOrder: existing.length,
			now: new Date().toISOString()
		});

		notifyLiveBoard(['schedule']);
		redirect(303, `/ties/${id}`);
	}
);

export const reorder = command(v.object({ ids: v.array(v.string()) }), async ({ ids }) => {
	requireAdmin();
	await reorderTies(ids, new Date().toISOString());
	notifyLiveBoard(['schedule']);
});

export const updateTie = form(
	v.object({
		id: v.pipe(v.string(), v.trim(), v.minLength(1)),
		tieCode: v.pipe(v.string(), v.trim(), v.minLength(1)),
		scheduledStartAt: v.optional(v.string()),
		venue: v.optional(v.string()),
		courtBlockCode: v.optional(v.string()),
		lineupDueAt: v.optional(v.string()),
		operationNote: v.optional(v.string()),
		scheduleChanged: v.optional(v.string()),
		assignedTeamIds: v.optional(v.array(v.string())),
		officiatingNote: v.optional(v.string())
	}),
	async ({
		id,
		tieCode,
		scheduledStartAt,
		venue,
		courtBlockCode,
		lineupDueAt,
		operationNote,
		scheduleChanged,
		assignedTeamIds,
		officiatingNote
	}) => {
		requireAdmin();
		const now = new Date().toISOString();

		await updateTieSchedule({
			id,
			tieCode,
			scheduledStartAt: emptyToNull(scheduledStartAt),
			venue: venueOrNull(venue),
			courtBlockCode: emptyToNull(courtBlockCode),
			lineupDueAt: emptyToNull(lineupDueAt),
			operationNote: emptyToNull(operationNote),
			scheduleChanged: scheduleChanged === 'on',
			now
		});

		await assignOfficiatingTeams({
			tieId: id,
			assignedTeamIds: uniqueNonEmpty(assignedTeamIds),
			note: emptyToNull(officiatingNote),
			now
		});

		notifyLiveBoard(['schedule']);
		return { message: '対戦情報を保存しました' };
	}
);
