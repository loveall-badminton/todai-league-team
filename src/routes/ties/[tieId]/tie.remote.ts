import { command, getRequestEvent, query } from '$app/server';
import { requireAdmin } from '$lib/server/auth/access';
import { notifyLiveBoard, notifyScoreChange } from '$lib/server/realtime/broadcast';
import { actionErrorMessage } from '$lib/server/errors';
import { deleteTie as deleteTieRepo } from '$lib/server/repositories/tokyoLeagueRepository';
import { getMatchState } from '$lib/server/repositories/matchRepository';
import {
	lockLineup as lockLineupService,
	revealLineups as revealLineupsService,
	unlockLineup as unlockLineupService,
	unrevealLineups as unrevealLineupsService
} from '$lib/server/services/lineupService';
import { getPublicRubbers } from '$lib/server/services/liveBoardService';
import {
	confirmTie as confirmTieService,
	cutoffTie as cutoffTieService,
	startTie as startTieService
} from '$lib/server/services/tieOperationService';
import { error } from '@sveltejs/kit';
import { applyMatchActionWithRealtime } from '$lib/server/services/matchRealtimeActionService';
import * as v from 'valibot';
import { getTieHeaderData, getTieLineupsData } from './tiePageData';
import { getMatchWithPlayers } from '$lib/server/repositories/matchRepository';

// header / lineups / liveRubbers を1リクエストで返す(3クエリに分けると
// 初期表示・全体 refresh のたびに Workers リクエストが3倍になるため)
export const getTieAdminPage = query(v.string(), async (tieId) => {
	requireAdmin();
	const [header, lineups, liveRubbers] = await Promise.all([
		getTieHeaderData(tieId),
		getTieLineupsData(tieId),
		getPublicRubbers(tieId)
	]);
	return { header, lineups, liveRubbers };
});

export const startTie = command(async () => {
	const tieId = requireAdminTieId();
	await runAdminMutation(
		() => startTieService(tieId),
		(resolvedTieId) =>
			notifyLiveBoard(['score', 'schedule'], {
				// 対戦開始でオーダーが公開されるため lineups スコープも含める
				schedule: { tieIds: [resolvedTieId], scopes: ['tie_header', 'rubbers', 'lineups'] }
			})
	);
});

export const confirmTie = command(async () => {
	const tieId = requireAdminTieId();
	await confirmTieService(tieId);
	notifyTieStructureChange(tieId);
});

export const cutoffTie = command(async () => {
	const tieId = requireAdminTieId();
	const { affectedMatchIds } = await runAdminMutation(
		() => cutoffTieService(tieId),
		notifyTieStructureChange
	);

	await Promise.all(
		affectedMatchIds.map(async (matchId) => {
			const state = await getMatchState(matchId);
			notifyScoreChange(matchId, ['score'], {
				score: { state, event: { type: 'cutoff' } }
			});
		})
	);
});

export const lockLineup = command(v.object({ teamId: v.string() }), async ({ teamId }) => {
	const tieId = requireAdminTieId();
	await runAdminMutation(() => lockLineupService({ tieId, teamId }), notifyTieLineupChange);
});

export const unlockLineup = command(v.object({ teamId: v.string() }), async ({ teamId }) => {
	const tieId = requireAdminTieId();
	await runAdminMutation(() => unlockLineupService({ tieId, teamId }), notifyTieLineupChange);
});

export const revealLineups = command(async () => {
	const tieId = requireAdminTieId();
	await runAdminMutation(() => revealLineupsService(tieId), notifyTieLineupChange);
});

export const unrevealLineups = command(async () => {
	const tieId = requireAdminTieId();
	await runAdminMutation(() => unrevealLineupsService(tieId), notifyTieLineupChange);
});

export const deleteTie = command(
	v.object({ force: v.optional(v.boolean()) }),
	async ({ force }) => {
		const tieId = requireAdminTieId();
		await deleteTieRepo(tieId, { force: force ?? false });
		notifyTieStructureChange(tieId);
	}
);

export const confirmMatch = command(v.object({ matchId: v.string() }), async ({ matchId }) => {
	requireAdmin();
	const match = await getMatchWithPlayers(matchId);
	if (!match) error(404, 'Match not found');
	const verificationReady =
		!!match.match.refereeName?.trim() &&
		!!match.match.winnerConfirmedAt &&
		!!match.match.winnerConfirmedBySide;
	if (!verificationReady) {
		error(400, '試合確定には審判名、勝者確認、運営承認の3点が必要です');
	}
	await applyLifecycleMatchAction(matchId, 'match_confirmed');
});

export const unconfirmMatch = command(v.object({ matchId: v.string() }), async ({ matchId }) => {
	requireAdmin();
	await applyLifecycleMatchAction(matchId, 'match_unconfirmed');
});

function requireAdminTieId() {
	requireAdmin();
	return getRequestEvent().params.tieId!;
}

async function runAdminMutation<T>(action: () => Promise<T>, notify: (tieId: string) => void) {
	const tieId = requireAdminTieId();
	try {
		const result = await action();
		notify(tieId);
		return result;
	} catch (caught) {
		error(400, actionErrorMessage(caught, '操作に失敗しました'));
	}
}

function notifyTieLineupChange(tieId: string) {
	notifyLiveBoard(['schedule'], {
		schedule: { tieIds: [tieId], scopes: ['tie_header', 'lineups'] }
	});
}

function notifyTieStructureChange(tieId: string) {
	notifyLiveBoard(['standings', 'schedule', 'finals'], {
		standings: { tieIds: [tieId] },
		schedule: { tieIds: [tieId], scopes: ['tie_header'] },
		finals: { tieIds: [tieId] }
	});
}

async function applyLifecycleMatchAction(
	matchId: string,
	type: 'match_confirmed' | 'match_unconfirmed'
) {
	const result = await applyMatchActionWithRealtime({
		matchId,
		input: {
			type,
			idempotencyKey: crypto.randomUUID(),
			observedSeqNo: await getMatchSeqNo(matchId)
		},
		actorName: null,
		now: new Date().toISOString()
	});
	notifyScoreChange(matchId, ['score'], { score: result.scorePayload });
	// 管理画面は必ず tie 配下で操作するため、payload を付けて関係ページだけに絞る
	const tieId = getRequestEvent().params.tieId;
	if (tieId) {
		notifyLiveBoard(['schedule', 'standings'], {
			schedule: { tieIds: [tieId], scopes: ['tie_header', 'rubbers'] },
			standings: { tieIds: [tieId] }
		});
	} else {
		notifyLiveBoard(['schedule', 'standings']);
	}
}

async function getMatchSeqNo(matchId: string): Promise<number> {
	const { getMatchState } = await import('$lib/server/repositories/matchRepository');
	const state = await getMatchState(matchId);
	return state.lastSeqNo;
}
