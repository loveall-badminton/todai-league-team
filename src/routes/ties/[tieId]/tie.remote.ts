import { command, form, getRequestEvent, query } from '$app/server';
import { requireAdmin } from '$lib/server/auth/access';
import { notifyLiveBoard, notifyMatch } from '$lib/server/realtime/broadcast';
import { actionErrorMessage } from '$lib/server/errors';
import { deleteTie as deleteTieRepo } from '$lib/server/repositories/tokyoLeagueRepository';
import { persistUpdateTie, updateTieFormFields } from '$lib/server/services/updateTieForm';
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
import { applyMatchAction } from '$lib/server/services/matchActionService';
import { error, redirect } from '@sveltejs/kit';
import * as v from 'valibot';

export const updateTie = form(v.object(updateTieFormFields), async (values) => {
	requireAdmin();
	const tieId = getRequestEvent().params.tieId!;
	await persistUpdateTie({ ...values, id: tieId, now: new Date().toISOString() });
	return { message: '対戦情報を保存しました' };
});

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
		error(400, actionErrorMessage(caught, '操作に失敗しました'));
	}
	notifyLiveBoard(['score', 'schedule']);
});

export const confirmTie = command(async () => {
	const event = getRequestEvent();
	requireAdmin();
	await confirmTieService(event.params.tieId!);
	notifyLiveBoard(['standings', 'schedule', 'finals']);
});

export const lockLineup = command(v.object({ teamId: v.string() }), async ({ teamId }) => {
	const event = getRequestEvent();
	requireAdmin();
	try {
		await lockLineupService({ tieId: event.params.tieId!, teamId });
	} catch (caught) {
		error(400, actionErrorMessage(caught, '操作に失敗しました'));
	}
	notifyLiveBoard(['schedule']);
});

export const unlockLineup = command(v.object({ teamId: v.string() }), async ({ teamId }) => {
	const event = getRequestEvent();
	requireAdmin();
	try {
		await unlockLineupService({ tieId: event.params.tieId!, teamId });
	} catch (caught) {
		error(400, actionErrorMessage(caught, '操作に失敗しました'));
	}
	notifyLiveBoard(['schedule']);
});

export const revealLineups = command(async () => {
	const event = getRequestEvent();
	requireAdmin();
	try {
		await revealLineupsService(event.params.tieId!);
	} catch (caught) {
		error(400, actionErrorMessage(caught, '操作に失敗しました'));
	}
	notifyLiveBoard(['schedule']);
});

export const unrevealLineups = command(async () => {
	const event = getRequestEvent();
	requireAdmin();
	try {
		await unrevealLineupsService(event.params.tieId!);
	} catch (caught) {
		error(400, actionErrorMessage(caught, '操作に失敗しました'));
	}
	notifyLiveBoard(['schedule']);
});

export const deleteTie = command(async () => {
	const event = getRequestEvent();
	requireAdmin();
	await deleteTieRepo(event.params.tieId!);
	notifyLiveBoard(['standings', 'schedule', 'finals']);
	redirect(303, '/ties');
});

export const confirmMatch = command(v.object({ matchId: v.string() }), async ({ matchId }) => {
	requireAdmin();
	await applyMatchAction({
		matchId,
		input: {
			type: 'match_confirmed',
			idempotencyKey: crypto.randomUUID(),
			observedSeqNo: await getMatchSeqNo(matchId)
		},
		actorName: null,
		now: new Date().toISOString()
	});
	notifyMatch(matchId);
	notifyLiveBoard(['score']);
});

export const unconfirmMatch = command(v.object({ matchId: v.string() }), async ({ matchId }) => {
	requireAdmin();
	await applyMatchAction({
		matchId,
		input: {
			type: 'match_unconfirmed',
			idempotencyKey: crypto.randomUUID(),
			observedSeqNo: await getMatchSeqNo(matchId)
		},
		actorName: null,
		now: new Date().toISOString()
	});
	notifyMatch(matchId);
	notifyLiveBoard(['score']);
});

async function getMatchSeqNo(matchId: string): Promise<number> {
	const { getMatchState } = await import('$lib/server/repositories/matchRepository');
	const state = await getMatchState(matchId);
	return state.lastSeqNo;
}
