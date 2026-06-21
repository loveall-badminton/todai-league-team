import { command, getRequestEvent, query } from '$app/server';
import { requireAdmin } from '$lib/server/auth/access';
import { notifyLiveBoard, notifyMatch } from '$lib/server/realtime/broadcast';
import { actionErrorMessage } from '$lib/server/errors';
import { deleteTie as deleteTieRepo } from '$lib/server/repositories/tokyoLeagueRepository';
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
import type { MatchState } from '$lib/domain/types';
import { error, redirect } from '@sveltejs/kit';
import * as v from 'valibot';
import { getTieHeaderData, getTieLineupsData } from './tiePageData';

export const getLiveRubbers = query(v.string(), async (tieId) => {
	requireAdmin();
	return getPublicRubbers(tieId);
});

export const getTieHeader = query(v.string(), async (tieId) => {
	requireAdmin();
	return getTieHeaderData(tieId);
});

export const getTieLineups = query(v.string(), async (tieId) => {
	requireAdmin();
	return getTieLineupsData(tieId);
});

export const startTie = command(async () => {
	const event = getRequestEvent();
	requireAdmin();
	try {
		await startTieService(event.params.tieId!);
	} catch (caught) {
		error(400, actionErrorMessage(caught, '操作に失敗しました'));
	}
	notifyLiveBoard(['score', 'schedule'], {
		schedule: { tieIds: [event.params.tieId!], scopes: ['tie_header', 'rubbers'] }
	});
});

export const confirmTie = command(async () => {
	const event = getRequestEvent();
	requireAdmin();
	await confirmTieService(event.params.tieId!);
	notifyLiveBoard(['standings', 'schedule', 'finals'], {
		standings: { tieIds: [event.params.tieId!] },
		schedule: { tieIds: [event.params.tieId!], scopes: ['tie_header'] },
		finals: { tieIds: [event.params.tieId!] }
	});
});

export const lockLineup = command(v.object({ teamId: v.string() }), async ({ teamId }) => {
	const event = getRequestEvent();
	requireAdmin();
	try {
		await lockLineupService({ tieId: event.params.tieId!, teamId });
	} catch (caught) {
		error(400, actionErrorMessage(caught, '操作に失敗しました'));
	}
	notifyLiveBoard(['schedule'], {
		schedule: { tieIds: [event.params.tieId!], scopes: ['tie_header', 'lineups'] }
	});
});

export const unlockLineup = command(v.object({ teamId: v.string() }), async ({ teamId }) => {
	const event = getRequestEvent();
	requireAdmin();
	try {
		await unlockLineupService({ tieId: event.params.tieId!, teamId });
	} catch (caught) {
		error(400, actionErrorMessage(caught, '操作に失敗しました'));
	}
	notifyLiveBoard(['schedule'], {
		schedule: { tieIds: [event.params.tieId!], scopes: ['tie_header', 'lineups'] }
	});
});

export const revealLineups = command(async () => {
	const event = getRequestEvent();
	requireAdmin();
	try {
		await revealLineupsService(event.params.tieId!);
	} catch (caught) {
		error(400, actionErrorMessage(caught, '操作に失敗しました'));
	}
	notifyLiveBoard(['schedule'], {
		schedule: { tieIds: [event.params.tieId!], scopes: ['tie_header', 'lineups'] }
	});
});

export const unrevealLineups = command(async () => {
	const event = getRequestEvent();
	requireAdmin();
	try {
		await unrevealLineupsService(event.params.tieId!);
	} catch (caught) {
		error(400, actionErrorMessage(caught, '操作に失敗しました'));
	}
	notifyLiveBoard(['schedule'], {
		schedule: { tieIds: [event.params.tieId!], scopes: ['tie_header', 'lineups'] }
	});
});

export const deleteTie = command(async () => {
	const event = getRequestEvent();
	requireAdmin();
	await deleteTieRepo(event.params.tieId!);
	notifyLiveBoard(['standings', 'schedule', 'finals'], {
		standings: { tieIds: [event.params.tieId!] },
		schedule: { tieIds: [event.params.tieId!], scopes: ['tie_header'] },
		finals: { tieIds: [event.params.tieId!] }
	});
	redirect(303, '/ties');
});

export const confirmMatch = command(v.object({ matchId: v.string() }), async ({ matchId }) => {
	requireAdmin();
	const afterState: MatchState = await applyMatchAction({
		matchId,
		input: {
			type: 'match_confirmed',
			idempotencyKey: crypto.randomUUID(),
			observedSeqNo: await getMatchSeqNo(matchId)
		},
		actorName: null,
		now: new Date().toISOString()
	});
	notifyMatch(matchId, ['score'], {
		score: { state: afterState, event: { type: 'match_confirmed' } }
	});
	notifyLiveBoard(['score'], {
		score: { state: afterState, event: { type: 'match_confirmed' } }
	});
});

export const unconfirmMatch = command(v.object({ matchId: v.string() }), async ({ matchId }) => {
	requireAdmin();
	const afterState: MatchState = await applyMatchAction({
		matchId,
		input: {
			type: 'match_unconfirmed',
			idempotencyKey: crypto.randomUUID(),
			observedSeqNo: await getMatchSeqNo(matchId)
		},
		actorName: null,
		now: new Date().toISOString()
	});
	notifyMatch(matchId, ['score'], {
		score: { state: afterState, event: { type: 'match_unconfirmed' } }
	});
	notifyLiveBoard(['score'], {
		score: { state: afterState, event: { type: 'match_unconfirmed' } }
	});
});

async function getMatchSeqNo(matchId: string): Promise<number> {
	const { getMatchState } = await import('$lib/server/repositories/matchRepository');
	const state = await getMatchState(matchId);
	return state.lastSeqNo;
}
