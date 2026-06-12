import { command, getRequestEvent } from '$app/server';
import { error, redirect } from '@sveltejs/kit';
import * as v from 'valibot';
import { requireAdmin } from '$lib/server/auth/access';
import { getRequestDb } from '$lib/server/db/request';
import { deleteTie as deleteTieRepo } from '$lib/server/repositories/tokyoLeagueRepository';
import {
	confirmTie as confirmTieService,
	createMatchFromRubber,
	startTie as startTieService,
	syncRubberResultFromMatch
} from '$lib/server/services/tieOperationService';
import {
	lockLineup as lockLineupService,
	revealLineups as revealLineupsService,
	unlockLineup as unlockLineupService,
	unrevealLineups as unrevealLineupsService
} from '$lib/server/services/lineupService';

function errMsg(caught: unknown) {
	return caught instanceof Error ? caught.message : '処理に失敗しました';
}

export const startTie = command(async () => {
	const event = getRequestEvent();
	requireAdmin(event);
	const db = getRequestDb(event.platform);
	try {
		await startTieService(db, event.params.tieId!);
	} catch (caught) {
		error(400, errMsg(caught));
	}
});

export const createMatch = command(v.object({ rubberId: v.string() }), async ({ rubberId }) => {
	const event = getRequestEvent();
	requireAdmin(event);
	const db = getRequestDb(event.platform);
	try {
		const matchId = await createMatchFromRubber(db, rubberId);
		redirect(303, `/referee/${matchId}`);
	} catch (caught) {
		error(400, errMsg(caught));
	}
});

export const syncResult = command(v.object({ matchId: v.string() }), async ({ matchId }) => {
	const event = getRequestEvent();
	requireAdmin(event);
	const db = getRequestDb(event.platform);
	await syncRubberResultFromMatch(db, matchId);
});

export const confirmTie = command(async () => {
	const event = getRequestEvent();
	requireAdmin(event);
	const db = getRequestDb(event.platform);
	await confirmTieService(db, event.params.tieId!);
});

export const lockLineup = command(v.object({ teamId: v.string() }), async ({ teamId }) => {
	const event = getRequestEvent();
	requireAdmin(event);
	const db = getRequestDb(event.platform);
	try {
		await lockLineupService(db, { tieId: event.params.tieId!, teamId });
	} catch (caught) {
		error(400, errMsg(caught));
	}
});

export const unlockLineup = command(v.object({ teamId: v.string() }), async ({ teamId }) => {
	const event = getRequestEvent();
	requireAdmin(event);
	const db = getRequestDb(event.platform);
	try {
		await unlockLineupService(db, { tieId: event.params.tieId!, teamId });
	} catch (caught) {
		error(400, errMsg(caught));
	}
});

export const revealLineups = command(async () => {
	const event = getRequestEvent();
	requireAdmin(event);
	const db = getRequestDb(event.platform);
	try {
		await revealLineupsService(db, event.params.tieId!);
	} catch (caught) {
		error(400, errMsg(caught));
	}
});

export const unrevealLineups = command(async () => {
	const event = getRequestEvent();
	requireAdmin(event);
	const db = getRequestDb(event.platform);
	try {
		await unrevealLineupsService(db, event.params.tieId!);
	} catch (caught) {
		error(400, errMsg(caught));
	}
});

export const deleteTie = command(async () => {
	const event = getRequestEvent();
	requireAdmin(event);
	await deleteTieRepo(getRequestDb(event.platform), event.params.tieId!);
	redirect(303, '/ties');
});
