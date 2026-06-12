import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { groupPhaseFor, type TiePhase } from '$lib/domain/tokyoLeague';
import { getRequestDb } from '$lib/server/db/request';
import {
	assignOfficiatingTeam,
	listScoringRules,
	listTeams,
	listTies,
	reorderTies,
	updateTieSchedule
} from '$lib/server/repositories/tokyoLeagueRepository';
import { createTieWithRubbers } from '$lib/server/services/tieService';
import { ensureDefaultSettings } from '$lib/server/services/tokyoLeagueSetupService';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getRequestDb(platform);
	await ensureDefaultSettings(db);
	const [ties, teams, scoringRules] = await Promise.all([
		listTies(db),
		listTeams(db),
		listScoringRules(db)
	]);
	return { ties, teams, scoringRules };
};

export const actions: Actions = {
	create: async ({ request, platform }) => {
		const formData = await request.formData();
		const tieCode = String(formData.get('tieCode') ?? '').trim();
		if (!tieCode) return fail(400, { message: 'tieCodeは必須です' });

		const groupCode = groupCodeOrNull(formData.get('groupCode'));
		const phase = phaseFromForm(formData.get('phase'), groupCode);
		const scoringRuleId = String(formData.get('scoringRuleId') ?? '').trim();
		if (!scoringRuleId) return fail(400, { message: '得点ルールは必須です' });

		const db = getRequestDb(platform);
		const existing = await listTies(db);
		const id = await createTieWithRubbers(db, {
			tieCode,
			phase,
			groupCode,
			roundLabel: emptyToNull(formData.get('roundLabel')),
			teamAId: emptyToNull(formData.get('teamAId')),
			teamBId: emptyToNull(formData.get('teamBId')),
			scheduledStartAt: emptyToNull(formData.get('scheduledStartAt')),
			venue: venueOrNull(formData.get('venue')),
			courtBlockCode: emptyToNull(formData.get('courtBlockCode')),
			lineupDueAt: emptyToNull(formData.get('lineupDueAt')),
			lineupDuePolicy: policyFromForm(formData.get('lineupDuePolicy')),
			scoringRuleId,
			displayOrder: existing.length,
			now: new Date().toISOString()
		});

		redirect(303, `/ties/${id}`);
	},

	reorder: async ({ request, platform }) => {
		const formData = await request.formData();
		const ids = JSON.parse(String(formData.get('ids') ?? '[]')) as string[];
		const db = getRequestDb(platform);
		await reorderTies(db, ids, new Date().toISOString());
		return {};
	},

	updateTie: async ({ request, platform }) => {
		const db = getRequestDb(platform);
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		const tieCode = String(formData.get('tieCode') ?? '').trim();
		if (!id || !tieCode) return fail(400, { message: 'コードは必須です' });
		const now = new Date().toISOString();

		await updateTieSchedule(db, {
			id,
			tieCode,
			scheduledStartAt: emptyToNull(formData.get('scheduledStartAt')),
			venue: venueOrNull(formData.get('venue')),
			courtBlockCode: emptyToNull(formData.get('courtBlockCode')),
			lineupDueAt: emptyToNull(formData.get('lineupDueAt')),
			operationNote: emptyToNull(formData.get('operationNote')),
			scheduleChanged: formData.get('scheduleChanged') === 'on',
			now
		});

		await assignOfficiatingTeam(db, {
			tieId: id,
			assignedTeamId: emptyToNull(formData.get('assignedTeamId')),
			note: emptyToNull(formData.get('officiatingNote')),
			now
		});

		return { message: '対戦情報を保存しました' };
	}
};

function emptyToNull(value: FormDataEntryValue | null): string | null {
	const text = String(value ?? '').trim();
	return text === '' ? null : text;
}

function groupCodeOrNull(value: FormDataEntryValue | null): 'A' | 'B' | null {
	const text = String(value ?? '');
	return text === 'A' || text === 'B' ? text : null;
}

function phaseFromForm(value: FormDataEntryValue | null, groupCode: 'A' | 'B' | null): TiePhase {
	if (groupCode) return groupPhaseFor(groupCode);
	const text = String(value ?? '');
	if (
		text === 'semifinal' ||
		text === 'final' ||
		text === 'third_place' ||
		text === 'fifth_place' ||
		text === 'ranking_tiebreaker'
	) {
		return text;
	}
	return 'semifinal';
}

function venueOrNull(value: FormDataEntryValue | null): 'first_gym' | 'second_gym' | null {
	const text = String(value ?? '');
	if (text === 'first_gym' || text === 'second_gym') return text;
	return null;
}

function policyFromForm(
	value: FormDataEntryValue | null
): 'first_match_before_opening' | 'ten_minutes_before' | 'manual' {
	const text = String(value ?? '');
	if (text === 'first_match_before_opening' || text === 'manual') return text;
	return 'ten_minutes_before';
}

