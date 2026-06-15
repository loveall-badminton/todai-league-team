import { command, form, getRequestEvent, query } from '$app/server';
import { requireAdmin } from '$lib/server/auth/access';
import {
	assignOfficiatingTeam,
	deleteTie as deleteTieRepo,
	updateTieSchedule
} from '$lib/server/repositories/tokyoLeagueRepository';
import {
	lockLineup as lockLineupService,
	revealLineups as revealLineupsService,
	unlockLineup as unlockLineupService,
	unrevealLineups as unrevealLineupsService
} from '$lib/server/services/lineupService';
import { getPublicRubbers } from '$lib/server/services/liveBoardService';
import {
	confirmTie as confirmTieService,
	startTie as startTieService
} from '$lib/server/services/tieOperationService';
import { error, redirect } from '@sveltejs/kit';
import * as v from 'valibot';

const emptyToNull = (s: string | undefined | null): string | null => {
	const text = (s ?? '').trim();
	return text === '' ? null : text;
};

const venueOrNull = (s: string | undefined | null): 'first_gym' | 'second_gym' | null => {
	if (s === 'first_gym' || s === 'second_gym') return s;
	return null;
};

function errMsg(caught: unknown) {
	return caught instanceof Error ? caught.message : '処理に失敗しました';
}

export const updateTie = form(
	v.object({
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
		requireAdmin();
		const tieId = getRequestEvent().params.tieId!;
		const now = new Date().toISOString();
		await updateTieSchedule({
			id: tieId,
			tieCode,
			scheduledStartAt: emptyToNull(scheduledStartAt),
			venue: venueOrNull(venue),
			courtBlockCode: emptyToNull(courtBlockCode),
			lineupDueAt: emptyToNull(lineupDueAt),
			operationNote: emptyToNull(operationNote),
			scheduleChanged: scheduleChanged === 'on',
			now
		});
		await assignOfficiatingTeam({
			tieId,
			assignedTeamId: emptyToNull(assignedTeamId),
			note: emptyToNull(officiatingNote),
			now
		});
		return { message: '対戦情報を保存しました' };
	}
);

export const getLiveRubbers = query(async () => {
	const event = getRequestEvent();
	requireAdmin();
	return getPublicRubbers(event.params.tieId!);
});

export const startTie = command(async () => {
	const event = getRequestEvent();
	requireAdmin();
	try {
		await startTieService(event.params.tieId!);
	} catch (caught) {
		error(400, errMsg(caught));
	}
});

export const confirmTie = command(async () => {
	const event = getRequestEvent();
	requireAdmin();
	await confirmTieService(event.params.tieId!);
});

export const lockLineup = command(v.object({ teamId: v.string() }), async ({ teamId }) => {
	const event = getRequestEvent();
	requireAdmin();
	try {
		await lockLineupService({ tieId: event.params.tieId!, teamId });
	} catch (caught) {
		error(400, errMsg(caught));
	}
});

export const unlockLineup = command(v.object({ teamId: v.string() }), async ({ teamId }) => {
	const event = getRequestEvent();
	requireAdmin();
	try {
		await unlockLineupService({ tieId: event.params.tieId!, teamId });
	} catch (caught) {
		error(400, errMsg(caught));
	}
});

export const revealLineups = command(async () => {
	const event = getRequestEvent();
	requireAdmin();
	try {
		await revealLineupsService(event.params.tieId!);
	} catch (caught) {
		error(400, errMsg(caught));
	}
});

export const unrevealLineups = command(async () => {
	const event = getRequestEvent();
	requireAdmin();
	try {
		await unrevealLineupsService(event.params.tieId!);
	} catch (caught) {
		error(400, errMsg(caught));
	}
});

export const deleteTie = command(async () => {
	const event = getRequestEvent();
	requireAdmin();
	await deleteTieRepo(event.params.tieId!);
	redirect(303, '/ties');
});
