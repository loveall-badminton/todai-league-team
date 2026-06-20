import { command, form } from '$app/server';
import { groupPhaseFor, type TiePhase } from '$lib/domain/tokyoLeague';
import { requireAdmin } from '$lib/server/auth/access';
import { listTies, reorderTies } from '$lib/server/repositories/tokyoLeagueRepository';
import { notifyLiveBoard } from '$lib/server/realtime/broadcast';
import { createTieWithRubbers } from '$lib/server/services/tieService';
import { persistUpdateTie } from '$lib/server/services/updateTieForm';
import { emptyToNull, venueOrNull } from '$lib/utils/validation';
import { redirect } from '@sveltejs/kit';
import * as v from 'valibot';
import { createTieSchema, updateTieSchema } from './ties.schema';

const policyFromValue = (
	s: string | undefined | null
): 'first_match_before_opening' | 'ten_minutes_before' | 'manual' => {
	if (s === 'first_match_before_opening' || s === 'manual') return s;
	return 'ten_minutes_before';
};

export const create = form(
	createTieSchema,
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

export const updateTie = form(updateTieSchema, async (values) => {
	requireAdmin();
	await persistUpdateTie({ ...values, now: new Date().toISOString() });
	return { message: '対戦情報を保存しました' };
});
