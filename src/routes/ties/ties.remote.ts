import { command, form, getRequestEvent } from '$app/server';
import { redirect } from '@sveltejs/kit';
import * as v from 'valibot';
import { groupPhaseFor, type TiePhase } from '$lib/domain/tokyoLeague';
import { requireAdmin } from '$lib/server/auth/access';
import { getRequestDb } from '$lib/server/db/request';
import {
	assignOfficiatingTeam,
	listTies,
	reorderTies,
	updateTieSchedule
} from '$lib/server/repositories/tokyoLeagueRepository';
import { createTieWithRubbers } from '$lib/server/services/tieService';

const emptyToNull = (s: string | undefined | null): string | null => {
	const text = (s ?? '').trim();
	return text === '' ? null : text;
};

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
		const event = getRequestEvent();
		requireAdmin(event);
		const db = getRequestDb(event.platform);
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

		const existing = await listTies(db);
		const id = await createTieWithRubbers(db, {
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

		redirect(303, `/ties/${id}`);
	}
);

export const reorder = command(v.object({ ids: v.array(v.string()) }), async ({ ids }) => {
	const event = getRequestEvent();
	requireAdmin(event);
	await reorderTies(getRequestDb(event.platform), ids, new Date().toISOString());
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
		assignedTeamId: v.optional(v.string()),
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
		assignedTeamId,
		officiatingNote
	}) => {
		const event = getRequestEvent();
		requireAdmin(event);
		const db = getRequestDb(event.platform);
		const now = new Date().toISOString();

		await updateTieSchedule(db, {
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

		await assignOfficiatingTeam(db, {
			tieId: id,
			assignedTeamId: emptyToNull(assignedTeamId),
			note: emptyToNull(officiatingNote),
			now
		});

		return { message: '対戦情報を保存しました' };
	}
);
